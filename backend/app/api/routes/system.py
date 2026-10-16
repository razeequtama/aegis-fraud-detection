from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.api.deps import require_permission
from app.db.seed import reset_demo_state

router = APIRouter(prefix="/api/v1/system", tags=["System & Maintenance"])


@router.post("/reset-demo")
def trigger_demo_reset(current_user: dict = Depends(require_permission("reset_demo"))):
    """
    Resets the demo playground back to pristine baseline.
    Protected by RBAC: requires 'reset_demo' permission (available to Senior Fraud Specialist).
    Restores the 9 curated sample investigation cases and resets unassigned review cases.
    """
    reset_demo_state()
    return {
        "status": "success",
        "message": "Demo data successfully reset to baseline. Curated investigation cases and review queues restored.",
        "triggered_by": current_user.get("name", "Analyst"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

