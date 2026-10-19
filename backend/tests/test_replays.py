from fastapi import BackgroundTasks
from sqlalchemy import Column, Float, MetaData, String, Table, create_engine
from sqlalchemy.orm import Session

from app.api.routes.replays import ReplayCreateRequest, create_replay
from app.models.replay_run import ReplayRun


def test_create_replay_defaults_to_ordinal_range_without_step_column():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String),
        Column("amount", Float),
        Column("label", String),
    )
    metadata.create_all(engine)
    ReplayRun.__table__.create(engine)
    with engine.begin() as connection:
        connection.execute(
            transactions.insert(),
            [
                {"transaction_id": "TX-1", "account_id": "ACC-1", "amount": 10, "label": "0"},
                {"transaction_id": "TX-2", "account_id": "ACC-2", "amount": 20, "label": "1"},
            ],
        )

    with Session(engine) as db:
        background_tasks = BackgroundTasks()
        response = create_replay(
            ReplayCreateRequest(
                model_version="aegis-v1",
                threshold=0.75,
            ),
            background_tasks,
            db,
        )
        replay = db.query(ReplayRun).filter(ReplayRun.id == response["job_id"]).one()

    assert response["status"] == "QUEUED"
    assert replay.start_step == 1
    assert replay.end_step == 2
    assert len(background_tasks.tasks) == 1
    engine.dispose()


def test_create_replay_rejects_batch_size_exceeding_5000():
    import pytest
    from fastapi import HTTPException
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String),
        Column("amount", Float),
        Column("step", Float),
        Column("label", String),
    )
    metadata.create_all(engine)
    ReplayRun.__table__.create(engine)
    with engine.begin() as connection:
        connection.execute(
            transactions.insert(),
            [
                {"transaction_id": "TX-1", "account_id": "ACC-1", "amount": 10, "step": 1, "label": "0"},
                {"transaction_id": "TX-2", "account_id": "ACC-2", "amount": 20, "step": 10000, "label": "1"},
            ],
        )

    with Session(engine) as db:
        background_tasks = BackgroundTasks()
        # Explicit request exceeding 5000 should raise 400
        with pytest.raises(HTTPException) as exc_info:
            create_replay(
                ReplayCreateRequest(
                    model_version="aegis-v1",
                    threshold=0.75,
                    start_step=1,
                    end_step=6000,
                ),
                background_tasks,
                db,
            )
        assert exc_info.value.status_code == 400
        assert "exceeds maximum allowed limit of 5,000" in exc_info.value.detail

        # Omitting end_step should safely default to start_step + 4999 = 5000
        response = create_replay(
            ReplayCreateRequest(
                model_version="aegis-v1",
                threshold=0.75,
                start_step=1,
            ),
            background_tasks,
            db,
        )
        assert response["status"] == "QUEUED"
        replay = db.query(ReplayRun).filter(ReplayRun.id == response["job_id"]).one()
        assert replay.start_step == 1
        assert replay.end_step == 5000
    engine.dispose()
