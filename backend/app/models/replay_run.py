from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text
from sqlalchemy.sql import func
from app.db.base_class import Base

class ReplayRun(Base):
    __tablename__ = "replay_runs"

    id = Column(Integer, primary_key=True, index=True)
    model_version = Column(String(50), nullable=False)
    threshold = Column(Float, nullable=False)
    start_step = Column(Integer, nullable=False)
    end_step = Column(Integer, nullable=False)
    status = Column(String(20), default="QUEUED", nullable=False)  # QUEUED, RUNNING, COMPLETED, FAILED
    metrics_summary = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)