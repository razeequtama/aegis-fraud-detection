from fastapi import APIRouter, HTTPException
from app.schemas.risk import RiskAssessmentRequest, RiskAssessmentResponse
from app.services.risk_engine import RiskEngineService

router = APIRouter(prefix="/api/v1", tags=["Risk Assessment"])
risk_engine = RiskEngineService()

@router.post("/risk-assessments", response_model=RiskAssessmentResponse)
def assess_risk(payload: RiskAssessmentRequest):
    try:
        result = risk_engine.evaluate_risk(payload.model_dump())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))