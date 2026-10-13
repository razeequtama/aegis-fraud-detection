from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Optional
import time

from app.db.session import engine, get_db
from app.services.risk_engine import risk_engine
from app.services.observability import (
    get_latency_metrics,
    record_api_latency,
    record_inference_latency,
)
from app.api.routes import investigation, metrics, network, replays

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


@app.middleware("http")
async def collect_api_latency(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    if request.url.path != "/api/v1/health":
        record_api_latency((time.perf_counter() - start_time) * 1000)
    return response


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
app.include_router(metrics.router)
app.include_router(investigation.router)
app.include_router(transactions.router, prefix="/api/v1", tags=["Transactions"])


@app.get("/api/v1/health")
def health_check(db: Session = Depends(get_db)):
    """Report backend, database pool, and model observability."""
    database_connected = False
    try:
        db.execute(text("SELECT 1"))
        database_connected = True
    except Exception:
        database_connected = False

    pool = engine.pool
    pool_size = pool.size() if hasattr(pool, "size") else None
    checked_out = pool.checkedout() if hasattr(pool, "checkedout") else None
    checked_in = pool.checkedin() if hasattr(pool, "checkedin") else None
    overflow = max(0, pool.overflow()) if hasattr(pool, "overflow") else None
    max_connections = (
        pool_size + pool._max_overflow
        if pool_size is not None and getattr(pool, "_max_overflow", -1) >= 0
        else None
    )
    model_loaded = risk_engine.model is not None and risk_engine.scaler is not None

    return {
        "status": "healthy" if database_connected and model_loaded else "degraded",
        "service": "aegis-backend",
        "database": {
            "status": "connected" if database_connected else "unavailable",
            "pool": {
                "active_connections": checked_out,
                "idle_connections": checked_in,
                "pool_size": pool_size,
                "overflow_connections": overflow,
                "max_connections": max_connections,
            },
        },
        "inference_engine": {
            "status": "loaded" if model_loaded else "unavailable",
            "model_loaded": model_loaded,
            "model_version": "aegis-rf-v1.0" if model_loaded else None,
        },
        "latency": get_latency_metrics(),
    }

@app.post("/api/v1/risk-assessments", response_model=RiskAssessmentResponse)
def assess_risk(payload: TransactionRequest):
    """
    Receive new transaction input, validate data, run risk engine model, 
    and return risk score with policy recommendation.
    """
    start_time = time.time()
    inference_start = time.perf_counter()
    
    try:
        # Convert request body to dict for processing
        tx_data = payload.dict()
        
        # Evaluate transaction using the risk engine service
        result = risk_engine.evaluate_transaction(tx_data)
        record_inference_latency((time.perf_counter() - inference_start) * 1000)
        
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