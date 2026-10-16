from datetime import date, datetime, timezone
from fastapi import HTTPException
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
        overview = get_metrics_overview(db=db)

    assert overview["metrics"]["total_transactions"] == 2
    assert overview["metrics"]["detected_frauds"] == 1
    assert overview["metrics"]["review_queue_count"] == 2
    assert overview["metrics"]["model_status"] in ("online", "unavailable")
    assert len(overview["trend"]) == 2
    assert overview["trend"][0] == {
        "date": "2026-01-01",
        "transactions": 1,
        "suspicious": 0,
    }
    assert overview["trend"][1] == {
        "date": "2026-01-02",
        "transactions": 1,
        "suspicious": 1,
    }
    assert overview["available_range"] == {
        "start_date": "2026-01-01",
        "end_date": "2026-01-02",
    }
    assert overview["busiest_period"] == {
        "start_date": "2026-01-01",
        "end_date": "2026-01-02",
        "transactions": 2,
    }
    engine.dispose()


def test_metrics_overview_filters_trend_to_requested_date_range():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String, nullable=False),
        Column("timestamp", DateTime(timezone=True)),
        Column("amount", Float, nullable=False),
        Column("label", Integer),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(
            transactions.insert(),
            [
                {
                    "transaction_id": "TX-JAN-1",
                    "account_id": "ACC-001",
                    "timestamp": datetime(2026, 1, 5, tzinfo=timezone.utc),
                    "amount": 100.0,
                    "label": 0,
                },
                {
                    "transaction_id": "TX-JAN-2",
                    "account_id": "ACC-002",
                    "timestamp": datetime(2026, 1, 20, tzinfo=timezone.utc),
                    "amount": 200.0,
                    "label": 1,
                },
                {
                    "transaction_id": "TX-FEB",
                    "account_id": "ACC-003",
                    "timestamp": datetime(2026, 2, 2, tzinfo=timezone.utc),
                    "amount": 300.0,
                    "label": 0,
                },
            ],
        )

    with Session(engine) as db:
        overview = get_metrics_overview(
            start_date=datetime(2026, 1, 1).date(),
            end_date=datetime(2026, 1, 31).date(),
            db=db,
        )

    assert overview["trend"] == [
        {"date": "2026-01-05", "transactions": 1, "suspicious": 0},
        {"date": "2026-01-20", "transactions": 1, "suspicious": 1},
    ]
    assert overview["available_range"] == {
        "start_date": "2026-01-05",
        "end_date": "2026-02-02",
    }
    assert overview["busiest_period"] == {
        "start_date": "2026-01-05",
        "end_date": "2026-01-20",
        "transactions": 2,
    }
    engine.dispose()


def test_metrics_overview_rejects_excessive_hourly_span_with_422():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String),
        Column("timestamp", DateTime(timezone=True)),
        Column("amount", Float),
        Column("label", Integer),
    )
    metadata.create_all(engine)

    with Session(engine) as db:
        with pytest.raises(HTTPException) as exc_info:
            get_metrics_overview(
                start_date=date(2020, 1, 1),
                end_date=date(2026, 1, 1),
                interval="hour",
                db=db,
            )
        assert exc_info.value.status_code == 422
        assert "Hourly metrics aggregation is limited to a maximum span" in exc_info.value.detail
    engine.dispose()


def test_metrics_overview_rejects_pre_epoch_start_date_with_422():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String),
        Column("timestamp", DateTime(timezone=True)),
        Column("amount", Float),
        Column("label", Integer),
    )
    metadata.create_all(engine)

    with Session(engine) as db:
        with pytest.raises(HTTPException) as exc_info:
            get_metrics_overview(
                start_date=date(1990, 1, 1),
                end_date=date(2026, 1, 1),
                db=db,
            )
        assert exc_info.value.status_code == 422
        assert "cannot be earlier than 2000-01-01" in exc_info.value.detail
    engine.dispose()


def test_metrics_overview_rejects_invalid_interval_with_422():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String),
        Column("timestamp", DateTime(timezone=True)),
        Column("amount", Float),
        Column("label", Integer),
    )
    metadata.create_all(engine)

    with Session(engine) as db:
        with pytest.raises(HTTPException) as exc_info:
            get_metrics_overview(
                interval="second",
                db=db,
            )
        assert exc_info.value.status_code == 422
        assert "Invalid interval 'second'" in exc_info.value.detail
    engine.dispose()


def test_metrics_overview_allows_valid_hourly_span():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String),
        Column("timestamp", DateTime(timezone=True)),
        Column("amount", Float),
        Column("label", Integer),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(
            transactions.insert(),
            [
                {
                    "transaction_id": "TX-1",
                    "account_id": "ACC-1",
                    "timestamp": datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc),
                    "amount": 50.0,
                    "label": 0,
                },
                {
                    "transaction_id": "TX-2",
                    "account_id": "ACC-2",
                    "timestamp": datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc),
                    "amount": 75.0,
                    "label": 1,
                },
            ],
        )

    with Session(engine) as db:
        res = get_metrics_overview(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 2),
            interval="hour",
            db=db,
        )
        assert res["granularity"] == "hourly"
        assert len(res["trend"]) > 0
    engine.dispose()
