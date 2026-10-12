from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.risk import RiskAssessmentRequest, RiskAssessmentResponse
from app.services.risk_engine import RiskEngineService
from app.db.repositories import FraudRepository

router = APIRouter(prefix="/api/v1", tags=["Risk Assessment"])
risk_engine = RiskEngineService()

@router.post("/risk-assessments", response_model=RiskAssessmentResponse)
def assess_risk(payload: RiskAssessmentRequest, db: Session = Depends(get_db)):
    try:
        # 1. Evaluate risk using the engine
        result = risk_engine.evaluate_risk(payload.model_dump())
        
        # 2. Save transaction and evaluation result to PostgreSQL
        FraudRepository.save_transaction(db, payload.model_dump())
        
        # 3. If decision is 'review' or 'decline', automatically generate an investigation case
        if result["decision"] in ["review", "decline"]:
            FraudRepository.create_case(
                db=db,
                transaction_id=payload.transaction_id,
                assigned_analyst="Unassigned",
                initial_status="open"
            )
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))