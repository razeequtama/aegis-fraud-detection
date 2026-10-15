from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(String(64), primary_key=True, index=True)
    account_id = Column(String(64), index=True, nullable=False)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    type = Column(String(20), nullable=True, default="TRANSFER")
    oldbalance_org = Column(Float, nullable=True, default=0.0)
    newbalance_orig = Column(Float, nullable=True, default=0.0)
    oldbalance_dest = Column(Float, nullable=True, default=0.0)
    newbalance_dest = Column(Float, nullable=True, default=0.0)
    device_id = Column(String(64), nullable=True)
    session_id = Column(String(64), nullable=True)
    is_fraud = Column(Integer, default=0, nullable=False)
    payment_attempts = Column(Integer, default=1, nullable=True)
    risk_score = Column(Float, nullable=True, index=True)

    @property
    def label(self):
        return self.is_fraud

    @label.setter
    def label(self, value):
        if value is None:
            self.is_fraud = 0
        elif isinstance(value, bool):
            self.is_fraud = 1 if value else 0
        elif isinstance(value, (int, float)):
            self.is_fraud = int(value)
        else:
            self.is_fraud = 1 if str(value).lower() in ("1", "true", "fraud", "decline") else 0


class InvestigationCase(Base):
    __tablename__ = "investigation_cases"

    case_id = Column(String(64), primary_key=True, index=True)
    transaction_id = Column(String(64), ForeignKey("transactions.transaction_id"), nullable=False)
    assigned_analyst = Column(String(64), default="Unassigned", nullable=True)
    status = Column(String(32), default="open", nullable=True)  # open, in_review, closed
    notes = Column(Text, nullable=True)
    feedback_label = Column(String(32), nullable=True)
    feedback_reasoning = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


# Aliases for backward compatibility
TransactionModel = Transaction
InvestigationCaseModel = InvestigationCase