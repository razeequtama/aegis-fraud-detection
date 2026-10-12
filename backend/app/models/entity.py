from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text, Integer
from sqlalchemy.sql import func
from app.db.session import Base

class Account(Base):
    __tablename__ = "accounts"
    account_id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="active")

class Device(Base):
    __tablename__ = "devices"
    device_id = Column(String, primary_key=True, index=True)
    first_seen = Column(DateTime(timezone=True), server_default=func.now())

class Transaction(Base):
    __tablename__ = "transactions"
    transaction_id = Column(String, primary_key=True, index=True)
    account_id = Column(String, ForeignKey("accounts.account_id"), index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    amount = Column(Numeric(12, 2), nullable=False)
    device_id = Column(String, ForeignKey("devices.device_id"), nullable=True)
    session_id = Column(String, nullable=True)
    label = Column(String, nullable=True)  # 'legitimate', 'fraud', dll.