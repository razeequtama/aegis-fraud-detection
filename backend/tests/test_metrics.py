from datetime import datetime, timezone

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
)
from sqlalchemy.orm import Session

from app.api.routes.metrics import get_metrics_overview


@pytest.mark.parametrize(
    ("account_column", "time_column", "fraud_column", "fraud_type"),
    [
        ("account_id", "timestamp", "label", Integer),
        ("name_orig", "created_at", "is_fraud", Boolean),
    ],
)
def test_metrics_overview_returns_database_totals_and_daily_trend(
    account_column, time_column, fraud_column, fraud_type
):
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column(account_column, String, nullable=False),
        Column(time_column, DateTime(timezone=True)),
        Column("amount", Float, nullable=False),
        Column(fraud_column, fraud_type),
    )
    cases = Table(
        "investigation_cases",
        metadata,
        Column("case_id", String, primary_key=True),
        Column("status", String),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(
            transactions.insert(),
            [
                {
                    "transaction_id": "TX-LEGIT",
                    account_column: "ACC-001",
                    time_column: datetime(2026, 1, 1, tzinfo=timezone.utc),
                    "amount": 100.0,
                    fraud_column: 0 if fraud_type is Integer else False,
                },
                {
                    "transaction_id": "TX-FRAUD",
                    account_column: "ACC-002",
                    time_column: datetime(2026, 1, 2, tzinfo=timezone.utc),
                    "amount": 200.0,
                    fraud_column: 1 if fraud_type is Integer else True,
                },
            ],
        )
        connection.execute(
            cases.insert(),
            [
                {"case_id": "CASE-OPEN", "status": "open"},
                {"case_id": "CASE-REVIEW", "status": "in_review"},
                {"case_id": "CASE-CLOSED", "status": "closed"},
            ],
        )

    with Session(engine) as db:
        overview = get_metrics_overview(db)

    assert overview["metrics"]["total_transactions"] == 2
    assert overview["metrics"]["detected_frauds"] == 1
    assert overview["metrics"]["review_queue_count"] == 2
    assert overview["metrics"]["model_status"] in ("online", "unavailable")
    assert len(overview["trend"]) == 14
    assert overview["trend"][-2] == {
        "date": "2026-01-01",
        "transactions": 1,
        "suspicious": 0,
    }
    assert overview["trend"][-1] == {
        "date": "2026-01-02",
        "transactions": 1,
        "suspicious": 1,
    }
    engine.dispose()
