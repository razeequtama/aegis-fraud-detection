import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import require_permission
from app.core.redis import acquire_demo_reset_lock
from app.db.seed import reset_demo_state

router = APIRouter(prefix="/api/v1/system", tags=["System & Maintenance"])

DEFAULT_RESET_COOLDOWN = int(os.environ.get("DEMO_RESET_COOLDOWN_SECONDS", 600))  # 10 minutes


@router.post("/reset-demo")
def trigger_demo_reset(current_user: dict = Depends(require_permission("reset_demo"))):
    """
    Resets the demo playground back to pristine baseline.
    Protected by RBAC: requires 'reset_demo' permission (available to Senior Fraud Specialist).
    Protected by global cooldown lock to prevent denial of service and data disruption.
    """
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

