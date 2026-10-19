from typing import Optional
from pydantic import BaseModel, Field


class CaseCreateRequest(BaseModel):
    transaction_id: str = Field(..., max_length=64, description="Unique transaction ID to investigate")
    assigned_analyst: Optional[str] = Field("Unassigned", max_length=64, description="Analyst username or ID")
    initial_status: Optional[str] = Field("open", max_length=32, description="Case status: open, in_review, closed")


class CaseUpdateRequest(BaseModel):
    status: Optional[str] = Field(None, max_length=32, description="Updated status: open, in_review, resolved_fraud, resolved_legitimate")
    assigned_analyst: Optional[str] = Field(None, max_length=64, description="Analyst username or ID")
    notes: Optional[str] = Field(None, max_length=2000, description="Investigation notes")


class AnalystFeedbackRequest(BaseModel):
    analyst_id: str = Field(..., max_length=64, description="Analyst username or identifier")
    label: str = Field(..., max_length=32, description="Confirmed label: confirmed_fraud, legitimate, inconclusive")
    reasoning: Optional[str] = Field(None, max_length=2000, description="Explanation or notes from the fraud analyst")
    notes: Optional[str] = Field(None, max_length=2000, description="Additional investigation notes")