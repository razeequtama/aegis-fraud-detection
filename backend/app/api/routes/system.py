import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.deps import require_permission
from app.core.limiter import limiter
from app.core.redis import acquire_demo_reset_lock, is_redis_available, REDIS_HOST, REDIS_PORT
from app.db.seed import reset_demo_state
from app.db.session import engine, get_db
from app.services.observability import get_latency_metrics
from app.services.risk_engine import risk_engine

router = APIRouter(prefix="/api/v1/system", tags=["System & Maintenance"])

DEFAULT_RESET_COOLDOWN = int(os.environ.get("DEMO_RESET_COOLDOWN_SECONDS", 600))  # 10 minutes


@router.post("/reset-demo")
@limiter.limit("1/15minute")
def trigger_demo_reset(
    request: Request,
    current_user: dict = Depends(require_permission("reset_demo")),
):
    """
    Resets the demo playground back to pristine baseline.
    Protected by environment gate: disabled in production environments unless explicitly allowed.
    Protected by RBAC: requires 'reset_demo' permission (available to Senior Fraud Specialist).
    Protected by global cooldown lock to prevent denial of service and data disruption.
    """
    app_env = os.environ.get("APP_ENV", "production").lower()
    enable_reset = os.environ.get("ENABLE_DEMO_RESET", "false").lower() in ("true", "1", "yes")
    if app_env == "production" and not enable_reset:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo sandbox reset is disabled in production environments.",
        )

    allowed, remaining_seconds = acquire_demo_reset_lock(cooldown_seconds=DEFAULT_RESET_COOLDOWN)
    if not allowed:
        remaining_minutes = max(1, (remaining_seconds + 59) // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Demo sandbox was recently reset. To prevent disruption for other active visitors, "
                f"the sandbox can only be reset once every {DEFAULT_RESET_COOLDOWN // 60} minutes. "
                f"Please wait {remaining_seconds}s (~{remaining_minutes} min) before resetting again."
            ),
            headers={"Retry-After": str(remaining_seconds)},
        )

    reset_demo_state()
    return {
        "status": "success",
        "message": "Demo data successfully reset to baseline. Curated investigation cases and review queues restored.",
        "triggered_by": current_user.get("name", "Analyst"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/diagnostics")
def get_system_diagnostics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("view")),
):
    """
    Authenticated diagnostics endpoint for system administrators and analysts.
    Reports connection pool telemetry, internal microservice addresses, and ML metrics.
    Protected by RBAC ('view' permission).
    """
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
