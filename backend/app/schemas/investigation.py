from pydantic import BaseModel, Field
from typing import Optional

class CaseCreateRequest(BaseModel):
    transaction_id: str
    assigned_analyst: Optional[str] = Field("Unassigned", description="Analyst username or ID")
    initial_status: Optional[str] = Field("open", description="Case status: open, in_review, closed")

class CaseUpdateRequest(BaseModel):
    status: Optional[str] = Field(None, description="Updated status: open, in_review, resolved_fraud, resolved_legitimate")
    assigned_analyst: Optional[str] = None
    notes: Optional[str] = None

class AnalystFeedbackRequest(BaseModel):
    analyst_id: str
    label: str = Field(..., description="Confirmed label: confirmed_fraud, legitimate, inconclusive")
    reasoning: Optional[str] = Field(None, description="Explanation or notes from the fraud analyst")