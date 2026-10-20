from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, select
from app.db.session import get_db
from app.schemas.investigation import CaseCreateRequest, CaseUpdateRequest, AnalystFeedbackRequest
from app.api.deps import require_permission
from app.db.repositories import FraudRepository
from app.models.models import Transaction, InvestigationCase

router = APIRouter(prefix="/api/v1", tags=["Investigation & Feedback"])


@router.get("/cases")
def list_investigation_cases(
    status: Optional[str] = Query(None, description="Filter by status: open, in_review, closed, all"),
    search: Optional[str] = Query(None, description="Search transaction_id, case_id, analyst"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("view")),
):
    resolved_page = int(page) if isinstance(page, (int, float)) or (isinstance(page, str) and page.isdigit()) else 1
    resolved_limit = int(limit) if isinstance(limit, (int, float)) or (isinstance(limit, str) and limit.isdigit()) else 20
    resolved_status = status if isinstance(status, str) else None
    resolved_search = search if isinstance(search, str) else None

    offset = (resolved_page - 1) * resolved_limit
    items, total = FraudRepository.get_cases(
        db=db,
        status=resolved_status,
        search=resolved_search,
        limit=resolved_limit,
        offset=offset,
    )
    summary = FraudRepository.get_cases_summary(db)
    return {
        "data": items,
        "total": total,
        "page": resolved_page,
        "limit": resolved_limit,
        "summary": summary,
    }


@router.get("/cases/urgent")
def get_urgent_alerts(
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("view")),
):
    """Returns top high-risk unreviewed alerts needing immediate investigation."""
    resolved_limit = int(limit) if isinstance(limit, (int, float)) or (isinstance(limit, str) and limit.isdigit()) else 6
    closed_txs = select(InvestigationCase.transaction_id).where(
        func.lower(InvestigationCase.status) == "closed"
    )

    urgent_txs = (
        db.query(Transaction)
        .filter(
            or_(
                Transaction.risk_score >= 0.75,
                Transaction.is_fraud == 1
            ),
            ~Transaction.transaction_id.in_(closed_txs)
        )
        .order_by(Transaction.risk_score.desc().nulls_last(), Transaction.amount.desc())
        .limit(resolved_limit)
        .all()
    )

    if not urgent_txs:
        return {"data": []}

    # Batch query all existing investigation cases in a single IN (...) trip, eliminating the N+1 query loop
    tx_ids = [tx.transaction_id for tx in urgent_txs]
    cases = (
        db.query(InvestigationCase)
        .filter(InvestigationCase.transaction_id.in_(tx_ids))
        .all()
    )
    cases_by_tx = {case.transaction_id: case for case in cases}

    results = []
    for tx in urgent_txs:
        existing_case = cases_by_tx.get(tx.transaction_id)
        results.append({
            "transaction_id": tx.transaction_id,
            "account_id": tx.account_id,
            "amount": float(tx.amount) if tx.amount else 0.0,
            "type": tx.type or "TRANSFER",
            "risk_score": float(tx.risk_score) if tx.risk_score is not None else 0.95,
            "device_id": tx.device_id,
            "case_id": existing_case.case_id if existing_case else None,
            "case_status": existing_case.status if existing_case else "unassigned",
            "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
        })
    return {"data": results}


@router.get("/cases/{case_id}")
def get_case_details(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("view")),
):
    case_obj = FraudRepository.get_case_by_id(db, case_id)
    if not case_obj:
        raise HTTPException(status_code=404, detail="Investigation case not found")
    return {"data": case_obj}


@router.post("/cases", status_code=201)
def create_investigation_case(
    payload: CaseCreateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("edit_case")),
):
    user_dict = current_user if isinstance(current_user, dict) else {"name": "Analyst"}
    assigned = payload.assigned_analyst if payload.assigned_analyst and payload.assigned_analyst != "Unassigned" else user_dict.get("name", "Analyst")
    db_case = FraudRepository.create_case(
        db=db,
        transaction_id=payload.transaction_id,
        assigned_analyst=assigned,
        initial_status=payload.initial_status or "open"
    )
    return {"message": "Investigation case created successfully", "data": db_case}


@router.patch("/cases/{case_id}")
def update_investigation_case(
    case_id: str,
    payload: CaseUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("edit_case")),
):
    user_dict = current_user if isinstance(current_user, dict) else {"name": "Analyst"}
    assigned = payload.assigned_analyst or user_dict.get("name")
    updated = FraudRepository.update_case(
        db=db,
        case_id=case_id,
        status=payload.status,
        assigned_analyst=assigned,
        notes=payload.notes,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Investigation case not found")
    return {"message": "Case updated successfully", "data": updated}


@router.post("/cases/{case_id}/feedback")
def submit_analyst_feedback(
    case_id: str,
    payload: AnalystFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("label_feedback")),
):
    updated_case = FraudRepository.update_case_feedback(
        db=db,
        case_id=case_id,
        label=payload.label,
        reasoning=payload.reasoning,
        notes=payload.notes,
    )
    if not updated_case:
        raise HTTPException(status_code=404, detail="Investigation case not found")
        
    return {
        "message": "Analyst feedback recorded successfully in database. Ready for future ML training loops.", 
        "data": updated_case
    }