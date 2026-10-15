from uuid import uuid4
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from app.models.models import Transaction, InvestigationCase, TransactionModel, InvestigationCaseModel


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
    def update_case_feedback(db: Session, case_id: str, label: str, reasoning: Optional[str]) -> Optional[InvestigationCase]:
        db_case = FraudRepository.get_case_by_id(db, case_id)
        if not db_case:
            return None
        
        db_case.feedback_label = label
        db_case.feedback_reasoning = reasoning
        db_case.status = "closed"  # Automatically close case once feedback is provided
        db.commit()
        db.refresh(db_case)
        return db_case