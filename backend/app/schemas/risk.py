from typing import List, Optional

from pydantic import BaseModel, Field


class RiskAssessmentRequest(BaseModel):
    transaction_id: str = Field(..., max_length=64, description="Unique identifier for the transaction")
    account_id: str = Field(..., max_length=64, description="Unique identifier for the user account")
    amount: float = Field(..., gt=0, description="Transaction amount in local currency")
    type: Optional[str] = Field("TRANSFER", max_length=32, description="Transaction type used by PaySim")
    oldbalanceOrg: Optional[float] = Field(0.0, description="Origin account old balance")
    newbalanceOrig: Optional[float] = Field(0.0, description="Origin account new balance")
    oldbalanceDest: Optional[float] = Field(0.0, description="Destination account old balance")
    newbalanceDest: Optional[float] = Field(0.0, description="Destination account new balance")
    device_id: Optional[str] = Field(None, max_length=64, description="Unique identifier for the device")
    session_id: Optional[str] = Field(None, max_length=64, description="Unique identifier for the browsing session")
    payment_attempts: Optional[int] = Field(1, ge=1, le=1000, description="Number of payment attempts made")
    language: Optional[str] = Field("en", max_length=10, description="Preferred language for signal telemetry: 'en' or 'id'")


class SignalItem(BaseModel):
    name: str = Field(..., max_length=128)
    description: str = Field(..., max_length=512)


class GraphMetricsItem(BaseModel):
    shared_devices_count: Optional[float] = 0.0
    node_degree: Optional[float] = 0.0


class RiskAssessmentResponse(BaseModel):
    transaction_id: str = Field(..., max_length=64)
    risk_score: float = Field(..., ge=0.0, le=1.0)
    decision: str = Field(..., max_length=32, description="Recommended decision: approve, review, or decline")
    model_version: str = Field(..., max_length=64)
    signals: List[SignalItem]
    latency_ms: float
    velocity: Optional[int] = 1
    graph_metrics: Optional[GraphMetricsItem] = None