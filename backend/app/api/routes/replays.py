from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.api.deps import require_permission
from app.db.session import get_db
from app.models.replay_run import ReplayRun
from app.services.replay_engine import get_replay_step_range, run_historical_replay

router = APIRouter(prefix="/api/v1/replays", tags=["replays"])

class ReplayCreateRequest(BaseModel):
    model_version: str = Field(..., min_length=1, max_length=50)
    threshold: float = Field(..., ge=0, le=1)
    start_step: Optional[int] = None
    end_step: Optional[int] = None

MAX_REPLAY_TRANSACTIONS = 5000


@router.post("", status_code=201)
def create_replay(
    payload: ReplayCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("run_replay")),
):
    # Enforce concurrency limit: reject if another replay is currently running or queued
    active_replay = db.query(ReplayRun).filter(ReplayRun.status.in_(["RUNNING", "QUEUED"])).first()
    if active_replay:
        raise HTTPException(
            status_code=409,
            detail=f"Another replay simulation is currently {active_replay.status.lower()} (ID: {active_replay.id}). Please wait for it to complete."
        )

    min_step, max_step = get_replay_step_range(db)
    if min_step is None or max_step is None:
        raise HTTPException(status_code=404, detail="No historical transactions are available for replay.")

    start_step = payload.start_step if payload.start_step is not None else min_step
    if payload.end_step is not None:
        end_step = payload.end_step
    else:
        # Default to a safe window of up to MAX_REPLAY_TRANSACTIONS
        end_step = min(max_step, start_step + MAX_REPLAY_TRANSACTIONS - 1)

    if start_step > end_step:
        raise HTTPException(status_code=400, detail="start_step must not be greater than end_step.")

    requested_count = end_step - start_step + 1
    if requested_count > MAX_REPLAY_TRANSACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Replay batch size ({requested_count:,} transactions) exceeds maximum allowed limit of {MAX_REPLAY_TRANSACTIONS:,} to prevent resource starvation."
        )

    new_replay = ReplayRun(
        model_version=payload.model_version,
        threshold=payload.threshold,
        start_step=start_step,
        end_step=end_step,
        status="QUEUED"
    )
    db.add(new_replay)
    db.commit()
    db.refresh(new_replay)

    # Trigger background worker (only send ID)
    background_tasks.add_task(run_historical_replay, new_replay.id)

    return {
        "job_id": new_replay.id,
        "replay_id": new_replay.id,
        "status": new_replay.status,
    }

@router.get("")
def list_replays(limit: int = 10, db: Session = Depends(get_db)):
    """List recent replay runs, newest first."""
    replays = (
        db.query(ReplayRun)
        .order_by(ReplayRun.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "job_id": r.id,
            "replay_id": r.id,
            "model_version": r.model_version,
            "threshold": r.threshold,
            "status": r.status,
            "metrics_summary": r.metrics_summary,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in replays
    ]

@router.get("/{replay_id}")
def get_replay_status(replay_id: int, db: Session = Depends(get_db)):
    replay = db.query(ReplayRun).filter(ReplayRun.id == replay_id).first()
    if not replay:
        raise HTTPException(status_code=404, detail="Replay run not found")
    
    return {
        "job_id": replay.id,
        "replay_id": replay.id,
        "model_version": replay.model_version,
        "threshold": replay.threshold,
        "status": replay.status,
        "metrics_summary": replay.metrics_summary,
        "error_message": replay.error_message,
        "created_at": replay.created_at
    }