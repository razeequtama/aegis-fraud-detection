from time import perf_counter

from fastapi import APIRouter, HTTPException

from app.schemas.risk import RiskAssessmentRequest, RiskAssessmentResponse
from app.services.risk_engine import risk_engine
from app.services.observability import record_inference_latency

router = APIRouter(prefix="/api/v1", tags=["Risk Assessment"])


@router.post("/risk-assessments", response_model=RiskAssessmentResponse)
def assess_risk(payload: RiskAssessmentRequest):
    try:
        started_at = perf_counter()
        result = risk_engine.evaluate_risk(payload.model_dump())
        latency_ms = (perf_counter() - started_at) * 1000
        record_inference_latency(latency_ms)

        return {
            **result,
            "transaction_id": payload.transaction_id,
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))