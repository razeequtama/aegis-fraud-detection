import asyncio
import logging
import os
import time
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import engine, get_db
from app.services.risk_engine import risk_engine
from app.services.observability import (
    get_latency_metrics,
    record_api_latency,
    record_inference_latency,
)
from app.core.redis import is_redis_available, REDIS_HOST, REDIS_PORT, acquire_demo_reset_lock
from app.core.limiter import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.api.routes import auth, investigation, metrics, models, network, replays, risk, system, transactions

logger = logging.getLogger("aegis.main")

app = FastAPI(
    title="AEGIS Fraud Detection API",
    version="1.0.0",
    description="Backend API for real-time risk scoring, transaction analysis, and fraud investigation."
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
allowed_origins = [
    origin.strip()
    for origin in raw_origins.split(",")
    if origin.strip()
] if raw_origins.strip() else DEFAULT_ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def schedule_daily_demo_reset():
    """Background coroutine that resets demonstration state every 24 hours in demo sandbox environments."""
    while True:
        try:
            # 24 hours = 86400 seconds
            await asyncio.sleep(86400)
            app_env = os.getenv("APP_ENV", "production").lower()
            enable_reset = os.getenv("ENABLE_DEMO_RESET", "false").lower() in ("true", "1", "yes")
            if app_env != "demo" and not enable_reset:
                logger.info("Demo auto-reset skipped (disabled in APP_ENV=%s).", app_env)
                continue

            # Global distributed lock ensures only one ASGI worker executes the reset in multi-worker setups
            allowed, _ = acquire_demo_reset_lock(cooldown_seconds=3600)
            if not allowed:
                logger.info("Scheduled demo sandbox auto-reset skipped (already handled by peer worker).")
                continue

            from app.db.seed import reset_demo_state
            logger.info("Executing scheduled 24-hour demo sandbox auto-reset...")
            reset_demo_state()
            logger.info("Scheduled 24-hour demo sandbox reset completed successfully.")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error during scheduled demo reset: {e}")


@app.on_event("startup")
async def on_startup():
    # Prime entity graph analyzer for real-time relational scoring
    try:
        from app.services.graph_analysis import graph_analyzer
        record_count = graph_analyzer.populate_from_db()
        logger.info("Graph analyzer initialized with %d transaction relationship records.", record_count)
    except Exception as exc:
        logger.warning("Graph analyzer startup initialization deferred: %s", exc)

    app_env = os.getenv("APP_ENV", "production").lower()
    enable_reset = os.getenv("ENABLE_DEMO_RESET", "false").lower() in ("true", "1", "yes")

    # In production, automated background state wipe is strictly disabled to prevent data loss
    if app_env == "production":
        logger.info("Automated daily demo sandbox reset task strictly disabled in production (APP_ENV=%s).", app_env)
        return

    if app_env == "demo" and enable_reset:
        logger.info("Automated daily demo sandbox reset task enabled (APP_ENV=%s).", app_env)
        asyncio.create_task(schedule_daily_demo_reset())
    else:
        logger.info("Automated daily demo sandbox reset task disabled (APP_ENV=%s, ENABLE_DEMO_RESET=%s).", app_env, enable_reset)


@app.middleware("http")
async def collect_api_latency(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    if request.url.path != "/api/v1/health":
        record_api_latency((time.perf_counter() - start_time) * 1000)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Include API Routers
app.include_router(auth.router)
app.include_router(models.router)
app.include_router(network.router)
app.include_router(replays.router)
app.include_router(metrics.router)
app.include_router(investigation.router)
app.include_router(risk.router)
app.include_router(system.router)
app.include_router(transactions.router, prefix="/api/v1", tags=["Transactions"])


@app.get("/health")
@app.get("/api/v1/health")
def health_check(db: Session = Depends(get_db)):
    """Simple public liveness and readiness probe without internal infrastructure disclosures."""
    database_connected = False
    try:
        db.execute(text("SELECT 1"))
        database_connected = True
    except Exception:
        database_connected = False

    model_loaded = risk_engine.model is not None and risk_engine.scaler is not None
    redis_connected = is_redis_available()

    return {
        "status": (
            "healthy"
            if database_connected and model_loaded and redis_connected
            else "degraded"
        ),
        "service": "aegis-backend",
        "version": "1.0.0",
    }
