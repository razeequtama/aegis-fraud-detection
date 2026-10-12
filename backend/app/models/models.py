from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base

class TransactionModel(Base):
    __tablename__ = "transactions"

    transaction_id = Column(String, primary_key=True, index=True)
    account_id = Column(String, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    device_id = Column(String, nullable=True)
    session_id = Column(String, nullable=True)
    payment_attempts = Column(Integer, default=1)
    label = Column(String, nullable=True)

class InvestigationCaseModel(Base):
    __tablename__ = "investigation_cases"

    case_id = Column(String, primary_key=True, index=True)
    transaction_id = Column(String, ForeignKey("transactions.transaction_id"), nullable=False)
    assigned_analyst = Column(String, default="Unassigned")
    status = Column(String, default="open")  # open, in_review, closed
    notes = Column(Text, nullable=True)
    feedback_label = Column(String, nullable=True)
    feedback_reasoning = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())