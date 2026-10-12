from pydantic import BaseModel, Field
from typing import Optional, List

class RiskAssessmentRequest(BaseModel):
    transaction_id: str = Field(..., description="Unique identifier for the transaction")
    account_id: str = Field(..., description="Unique identifier for the user account")
    amount: float = Field(..., gt=0, description="Transaction amount in local currency")
    device_id: Optional[str] = Field(None, description="Unique identifier for the device")
    session_id: Optional[str] = Field(None, description="Unique identifier for the browsing session")
    payment_attempts: Optional[int] = Field(1, ge=1, description="Number of payment attempts made")

class SignalItem(BaseModel):
    name: str
    description: str

class RiskAssessmentResponse(BaseModel):
    transaction_id: str
    risk_score: float = Field(..., ge=0.0, le=1.0)
    decision: str = Field(..., description="Recommended decision: approve, review, or decline")
    model_version: str
    signals: List[SignalItem]
    latency_ms: float