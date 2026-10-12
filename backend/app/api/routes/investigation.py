from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.investigation import CaseCreateRequest, CaseUpdateRequest, AnalystFeedbackRequest
from app.db.repositories import FraudRepository

router = APIRouter(prefix="/api/v1", tags=["Investigation & Feedback"])

@router.post("/cases", status_code=201)
def create_investigation_case(payload: CaseCreateRequest, db: Session = Depends(get_db)):
    db_case = FraudRepository.create_case(
        db=db,
        transaction_id=payload.transaction_id,
        assigned_analyst=payload.assigned_analyst,
        initial_status=payload.initial_status
    )
    return {"message": "Investigation case created successfully", "data": db_case}

@router.post("/cases/{case_id}/feedback")
def submit_analyst_feedback(case_id: str, payload: AnalystFeedbackRequest, db: Session = Depends(get_db)):
    updated_case = FraudRepository.update_case_feedback(
        db=db,
        case_id=case_id,
        label=payload.label,
        reasoning=payload.reasoning
    )
    if not updated_case:
        raise HTTPException(status_code=404, detail="Investigation case not found")
        
    return {
        "message": "Analyst feedback recorded successfully in database. Ready for future ML training loops.", 
        "data": updated_case
    }