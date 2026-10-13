from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import time

from app.services.risk_engine import risk_engine
from app.api.routes import network, replays

from app.api.routes import transactions

app = FastAPI(
    title="AEGIS Fraud Detection API",
    version="1.0.0",
    description="Backend API for real-time risk scoring, transaction analysis, and fraud investigation."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Request Models for strict input validation
class TransactionRequest(BaseModel):
    transaction_id: str = Field(..., example="TX-10021")
    account_id: str = Field(..., example="ACC-105")
    amount: float = Field(..., ge=0, example=850000.0)
    type: Optional[str] = Field("TRANSFER", example="TRANSFER")
    oldbalanceOrg: Optional[float] = Field(0.0, example=1000000.0)
    newbalanceOrig: Optional[float] = Field(0.0, example=150000.0)
    oldbalanceDest: Optional[float] = Field(0.0, example=0.0)
    newbalanceDest: Optional[float] = Field(0.0, example=850000.0)
    device_id: Optional[str] = Field("DEV-021", example="DEV-021")
    session_id: Optional[str] = Field("SES-991", example="SES-991")

class SignalItem(BaseModel):
    name: str
    description: str

class RiskAssessmentResponse(BaseModel):
    transaction_id: str
    risk_score: float
    decision: str
    model_version: str
    signals: List[SignalItem]
    latency_ms: int

# Include API Routers
app.include_router(network.router)
app.include_router(replays.router)
app.include_router(transactions.router, prefix="/api/v1", tags=["Transactions"])


@app.get("/api/v1/health")
def health_check():
    """Check basic API health and model status."""
    return {
        "status": "healthy",
        "service": "aegis-backend",
        "model_loaded": risk_engine.model is not None
    }

@app.post("/api/v1/risk-assessments", response_model=RiskAssessmentResponse)
def assess_risk(payload: TransactionRequest):
    """
    Receive new transaction input, validate data, run risk engine model, 
    and return risk score with policy recommendation.
    """
    start_time = time.time()
    
    try:
        # Convert request body to dict for processing
        tx_data = payload.dict()
        
        # Evaluate transaction using the risk engine service
        result = risk_engine.evaluate_transaction(tx_data)
        
        latency = int((time.time() - start_time) * 1000)
        
        return {
            "transaction_id": payload.transaction_id,
            "risk_score": result["risk_score"],
            "decision": result["decision"],
            "model_version": result["model_version"],
            "signals": result["signals"],
            "latency_ms": latency
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))