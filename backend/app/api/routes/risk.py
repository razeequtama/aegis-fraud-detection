from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.repositories import FraudRepository
from app.db.session import get_db
from app.schemas.risk import RiskAssessmentRequest, RiskAssessmentResponse
from app.services.risk_engine import risk_engine

router = APIRouter(prefix="/api/v1", tags=["Risk Assessment"])


@router.post("/risk-assessments", response_model=RiskAssessmentResponse)
def assess_risk(payload: RiskAssessmentRequest, db: Session = Depends(get_db)):
    try:
        started_at = perf_counter()
        result = risk_engine.evaluate_risk(payload.model_dump())
        FraudRepository.save_transaction(db, payload.model_dump(), label=result["decision"])

        if result["decision"] in ["review", "decline"]:
            FraudRepository.create_case(
                db=db,
                transaction_id=payload.transaction_id,
                assigned_analyst="Unassigned",
                initial_status="open",
            )

        return {
            **result,
            "transaction_id": payload.transaction_id,
            "latency_ms": (perf_counter() - started_at) * 1000,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))