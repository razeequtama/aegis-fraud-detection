from uuid import uuid4

from sqlalchemy.orm import Session
from app.models.models import TransactionModel, InvestigationCaseModel
from typing import Dict, Any, Optional

class FraudRepository:
    @staticmethod
    def save_transaction(db: Session, payload: Dict[str, Any], label: Optional[str] = None) -> TransactionModel:
        db_txn = TransactionModel(
            transaction_id=payload.get("transaction_id"),
            account_id=payload.get("account_id"),
            amount=payload.get("amount"),
            device_id=payload.get("device_id"),
            session_id=payload.get("session_id"),
            payment_attempts=payload.get("payment_attempts", 1),
            label=label
        )
        db_txn = db.merge(db_txn)  # Use merge to handle upsert-like behavior if ID exists
        db.commit()
        db.refresh(db_txn)
        return db_txn

    @staticmethod
    def create_case(db: Session, transaction_id: str, assigned_analyst: str, initial_status: str) -> InvestigationCaseModel:
        existing_case = (
            db.query(InvestigationCaseModel)
            .filter(InvestigationCaseModel.transaction_id == transaction_id)
            .first()
        )
        if existing_case is not None:
            return existing_case

        case_id = f"CASE-{uuid4().hex}"
        db_case = InvestigationCaseModel(
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
    def get_case_by_id(db: Session, case_id: str) -> Optional[InvestigationCaseModel]:
        return db.query(InvestigationCaseModel).filter(InvestigationCaseModel.case_id == case_id).first()

    @staticmethod
    def update_case_feedback(db: Session, case_id: str, label: str, reasoning: Optional[str]) -> Optional[InvestigationCaseModel]:
        db_case = FraudRepository.get_case_by_id(db, case_id)
        if not db_case:
            return None
        
        db_case.feedback_label = label
        db_case.feedback_reasoning = reasoning
        db_case.status = "closed"  # Automatically close case once feedback is provided
        db.commit()
        db.refresh(db_case)
        return db_case