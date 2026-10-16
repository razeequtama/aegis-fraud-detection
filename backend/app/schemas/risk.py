from typing import List, Optional

from pydantic import BaseModel, Field


class RiskAssessmentRequest(BaseModel):
    transaction_id: str = Field(..., description="Unique identifier for the transaction")
    account_id: str = Field(..., description="Unique identifier for the user account")
    amount: float = Field(..., gt=0, description="Transaction amount in local currency")
    type: Optional[str] = Field("TRANSFER", description="Transaction type used by PaySim")
    oldbalanceOrg: Optional[float] = Field(0.0, description="Origin account old balance")
    newbalanceOrig: Optional[float] = Field(0.0, description="Origin account new balance")
    oldbalanceDest: Optional[float] = Field(0.0, description="Destination account old balance")
    newbalanceDest: Optional[float] = Field(0.0, description="Destination account new balance")
    device_id: Optional[str] = Field(None, description="Unique identifier for the device")
    session_id: Optional[str] = Field(None, description="Unique identifier for the browsing session")
    payment_attempts: Optional[int] = Field(1, ge=1, description="Number of payment attempts made")
    language: Optional[str] = Field("en", description="Preferred language for signal telemetry: 'en' or 'id'")


class SignalItem(BaseModel):
    name: str
    description: str


class GraphMetricsItem(BaseModel):
    shared_devices_count: Optional[float] = 0.0
    node_degree: Optional[float] = 0.0


class RiskAssessmentResponse(BaseModel):
    transaction_id: str
    risk_score: float = Field(..., ge=0.0, le=1.0)
    decision: str = Field(..., description="Recommended decision: approve, review, or decline")
    model_version: str
    signals: List[SignalItem]
    latency_ms: float
    velocity: Optional[int] = 1
    graph_metrics: Optional[GraphMetricsItem] = None