from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
import time

from app.db.session import engine, get_db
from app.services.risk_engine import risk_engine
from app.services.observability import (
    get_latency_metrics,
    record_api_latency,
    record_inference_latency,
)
from app.core.redis import is_redis_available, REDIS_HOST, REDIS_PORT
from app.api.routes import investigation, metrics, network, replays, risk
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


# Include API Routers
app.include_router(network.router)
app.include_router(replays.router)
app.include_router(metrics.router)
app.include_router(investigation.router)
app.include_router(risk.router)
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
    redis_connected = is_redis_available()

    return {
        "status": (
            "healthy"
            if database_connected and model_loaded and redis_connected
            else "degraded"
        ),
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
        "redis": {
            "status": "connected" if redis_connected else "unavailable",
            "host": REDIS_HOST,
            "port": REDIS_PORT,
        },
        "inference_engine": {
            "status": "loaded" if model_loaded else "unavailable",
            "model_loaded": model_loaded,
            "model_version": risk_engine.model_version if model_loaded else None,
        },
        "latency": get_latency_metrics(),
    }