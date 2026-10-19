from uuid import uuid4
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.models import Transaction, InvestigationCase, TransactionModel, InvestigationCaseModel


def escape_like_pattern(text: str) -> str:
    """Escapes SQL LIKE wildcard characters (%, _, \\) to prevent pattern injection and full table scans."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class FraudRepository:
    @staticmethod
    def save_transaction(db: Session, payload: Dict[str, Any], label: Optional[str] = None) -> Transaction:
        is_fraud_val = payload.get("is_fraud")
        if is_fraud_val is None and label is not None:
            is_fraud_val = 1 if str(label).lower() in ("1", "true", "fraud", "decline") else 0
        elif is_fraud_val is None:
            is_fraud_val = 0

        db_txn = Transaction(
            transaction_id=payload.get("transaction_id"),
            account_id=payload.get("account_id"),
            amount=payload.get("amount"),
            type=payload.get("type", "TRANSFER"),
            oldbalance_org=payload.get("oldbalance_org", payload.get("oldbalanceOrg", 0.0)),
            newbalance_orig=payload.get("newbalance_orig", payload.get("newbalanceOrig", 0.0)),
            oldbalance_dest=payload.get("oldbalance_dest", payload.get("oldbalanceDest", 0.0)),
            newbalance_dest=payload.get("newbalance_dest", payload.get("newbalanceDest", 0.0)),
            device_id=payload.get("device_id"),
            session_id=payload.get("session_id"),
            payment_attempts=payload.get("payment_attempts", 1),
            is_fraud=int(is_fraud_val),
        )
        db_txn = db.merge(db_txn)  # Use merge to handle upsert-like behavior if ID exists
        db.commit()
        db.refresh(db_txn)
        return db_txn

    @staticmethod
    def create_case(db: Session, transaction_id: str, assigned_analyst: str, initial_status: str) -> InvestigationCase:
        existing_case = (
            db.query(InvestigationCase)
            .filter(InvestigationCase.transaction_id == transaction_id)
            .first()
        )
        if existing_case is not None:
            return existing_case

        case_id = f"CASE-{uuid4().hex}"
        db_case = InvestigationCase(
            case_id=case_id,
            transaction_id=transaction_id,
            assigned_analyst=assigned_analyst,
            status=initial_status
        )
        db.add(db_case)
        db.commit()
        db.refresh(db_case)
        return db_case

    @staticmethod
    def get_case_by_id(db: Session, case_id: str) -> Optional[InvestigationCase]:
        return db.query(InvestigationCase).filter(InvestigationCase.case_id == case_id).first()

    @staticmethod
    def get_cases(
        db: Session,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        query = (
            db.query(
                InvestigationCase,
                Transaction.amount,
                Transaction.type,
                Transaction.risk_score,
                Transaction.is_fraud,
                Transaction.account_id,
                Transaction.timestamp,
            )
            .outerjoin(
                Transaction,
                InvestigationCase.transaction_id == Transaction.transaction_id,
            )
        )

        if status and status.lower() not in ("all", ""):
            query = query.filter(func.lower(InvestigationCase.status) == status.lower())

        if search and search.strip():
            escaped_term = escape_like_pattern(search.strip())
            term = f"%{escaped_term}%"
            query = query.filter(
                or_(
                    InvestigationCase.case_id.ilike(term, escape="\\"),
                    InvestigationCase.transaction_id.ilike(term, escape="\\"),
                    InvestigationCase.assigned_analyst.ilike(term, escape="\\"),
                    InvestigationCase.feedback_label.ilike(term, escape="\\"),
                )
            )

        total = query.count()
        rows = (
            query.order_by(InvestigationCase.updated_at.desc().nulls_last())
            .offset(offset)
            .limit(limit)
            .all()
        )

        items = []
        for case_obj, amount, tx_type, risk_score, is_fraud, account_id, timestamp in rows:
            items.append({
                "case_id": case_obj.case_id,
                "transaction_id": case_obj.transaction_id,
                "assigned_analyst": case_obj.assigned_analyst,
                "status": case_obj.status or "open",
                "notes": case_obj.notes,
                "feedback_label": case_obj.feedback_label,
                "feedback_reasoning": case_obj.feedback_reasoning,
                "updated_at": case_obj.updated_at.isoformat() if case_obj.updated_at else None,
                "amount": float(amount) if amount is not None else None,
                "type": tx_type,
                "risk_score": float(risk_score) if risk_score is not None else None,
                "is_fraud": int(is_fraud) if is_fraud is not None else 0,
                "account_id": account_id,
                "timestamp": timestamp.isoformat() if timestamp else None,
            })

        return items, total

    @staticmethod
    def get_cases_summary(db: Session) -> dict:
        total_cases = db.query(InvestigationCase).count()
        open_cases = db.query(InvestigationCase).filter(func.lower(InvestigationCase.status) == "open").count()
        in_review = db.query(InvestigationCase).filter(func.lower(InvestigationCase.status) == "in_review").count()
        closed_cases = db.query(InvestigationCase).filter(func.lower(InvestigationCase.status) == "closed").count()

        confirmed_fraud = db.query(InvestigationCase).filter(func.lower(InvestigationCase.feedback_label) == "confirmed_fraud").count()
        legitimate = db.query(InvestigationCase).filter(func.lower(InvestigationCase.feedback_label) == "legitimate").count()
        inconclusive = db.query(InvestigationCase).filter(func.lower(InvestigationCase.feedback_label) == "inconclusive").count()

        return {
            "total_cases": total_cases,
            "open": open_cases,
            "in_review": in_review,
            "closed": closed_cases,
            "confirmed_fraud": confirmed_fraud,
            "legitimate": legitimate,
            "inconclusive": inconclusive,
        }

    @staticmethod
    def update_case(
        db: Session,
        case_id: str,
        status: Optional[str] = None,
        assigned_analyst: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Optional[InvestigationCase]:
        db_case = FraudRepository.get_case_by_id(db, case_id)
        if not db_case:
            return None

        if status is not None:
            db_case.status = status
        if assigned_analyst is not None:
            db_case.assigned_analyst = assigned_analyst
        if notes is not None:
            db_case.notes = notes

        db.commit()
        db.refresh(db_case)
        return db_case

    @staticmethod
    def update_case_feedback(
        db: Session,
        case_id: str,
        label: str,
        reasoning: Optional[str],
        notes: Optional[str] = None,
    ) -> Optional[InvestigationCase]:
        db_case = FraudRepository.get_case_by_id(db, case_id)
        if not db_case:
            return None
        
        db_case.feedback_label = label
        db_case.feedback_reasoning = reasoning
        if notes is not None:
            db_case.notes = notes
        db_case.status = "closed"  # Automatically close case once feedback is provided
        db.commit()
        db.refresh(db_case)
        return db_case