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
