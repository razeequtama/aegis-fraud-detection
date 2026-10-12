from fastapi import APIRouter, HTTPException
from app.schemas.investigation import CaseCreateRequest, CaseUpdateRequest, AnalystFeedbackRequest
from typing import Dict, Any

router = APIRouter(prefix="/api/v1", tags=["Investigation & Feedback"])

# In-memory storage mock for demonstration (will be replaced by PostgreSQL/SQLAlchemy repository)
mock_cases_db: Dict[str, Dict[str, Any]] = {}

@router.post("/cases", status_code=201)
def create_investigation_case(payload: CaseCreateRequest):
    case_id = f"CASE-{len(mock_cases_db) + 1001}"
    case_data = {
        "case_id": case_id,
        "transaction_id": payload.transaction_id,
        "assigned_analyst": payload.assigned_analyst,
        "status": payload.initial_status,
        "notes": None,
        "feedback": None
    }
    mock_cases_db[case_id] = case_data
    return {"message": "Investigation case created successfully", "data": case_data}

@router.patch("/cases/{case_id}")
def update_investigation_case(case_id: str, payload: CaseUpdateRequest):
    if case_id not in mock_cases_db:
        raise HTTPException(status_code=404, detail="Investigation case not found")
    
    case = mock_cases_db[case_id]
    if payload.status:
        case["status"] = payload.status
    if payload.assigned_analyst:
        case["assigned_analyst"] = payload.assigned_analyst
    if payload.notes:
        case["notes"] = payload.notes
        
    return {"message": "Case updated successfully", "data": case}

@router.post("/cases/{case_id}/feedback")
def submit_analyst_feedback(case_id: str, payload: AnalystFeedbackRequest):
    if case_id not in mock_cases_db:
        raise HTTPException(status_code=404, detail="Investigation case not found")
    
    case = mock_cases_db[case_id]
    feedback_data = {
        "analyst_id": payload.analyst_id,
        "label": payload.label,
        "reasoning": payload.reasoning
    }
    case["feedback"] = feedback_data
    case["status"] = "closed"  # Automatically close case once feedback is provided
    
    return {"message": "Analyst feedback recorded successfully. Ready for future ML training loops.", "data": case}