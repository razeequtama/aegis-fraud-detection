from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(50), unique=True, index=True, nullable=False)
    account_id = Column(String(50), index=True, nullable=False)
    step = Column(Integer, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String(20), nullable=True)
    oldbalanceOrg = Column(Float, nullable=True)
    newbalanceOrig = Column(Float, nullable=True)
    oldbalanceDest = Column(Float, nullable=True)
    newbalanceDest = Column(Float, nullable=True)
    device_id = Column(String(50), nullable=True)
    session_id = Column(String(50), nullable=True)
    is_fraud = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())