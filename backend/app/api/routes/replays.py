from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.replay_run import ReplayRun
from app.services.replay_engine import run_historical_replay

router = APIRouter(prefix="/api/v1/replays", tags=["replays"])

class ReplayCreateRequest(BaseModel):
    model_version: str
    threshold: float
    start_step: int
    end_step: int

@router.post("", status_code=201)
def create_replay(payload: ReplayCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    new_replay = ReplayRun(
        model_version=payload.model_version,
        threshold=payload.threshold,
        start_step=payload.start_step,
        end_step=payload.end_step,
        status="QUEUED"
    )
    db.add(new_replay)
    db.commit()
    db.refresh(new_replay)

    # Trigger background worker (hanya kirim ID)
    background_tasks.add_task(run_historical_replay, new_replay.id)

    return {"replay_id": new_replay.id, "status": new_replay.status}

@router.get("/{replay_id}")
def get_replay_status(replay_id: int, db: Session = Depends(get_db)):
    replay = db.query(ReplayRun).filter(ReplayRun.id == replay_id).first()
    if not replay:
        raise HTTPException(status_code=404, detail="Replay run not found")
    
    return {
        "replay_id": replay.id,
        "model_version": replay.model_version,
        "threshold": replay.threshold,
        "status": replay.status,
        "metrics_summary": replay.metrics_summary,
        "error_message": replay.error_message,
        "created_at": replay.created_at
    }