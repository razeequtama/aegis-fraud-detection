from types import SimpleNamespace

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

from app.services.replay_engine import (
    BASELINE_THRESHOLD,
    _get_operational_metrics,
    get_replay_step_range,
    load_replay_transactions,
)


def test_operational_metrics_include_false_positive_rate():
    transactions = [
        SimpleNamespace(amount=250_000, is_fraud=1),
        SimpleNamespace(amount=250_000, is_fraud=0),
        SimpleNamespace(amount=100_000, is_fraud=0),
    ]

    metrics = _get_operational_metrics(transactions, threshold=0.75)

    assert BASELINE_THRESHOLD == 0.75
    assert metrics == {
        "total_processed": 3,
        "review_count": 2,
        "fraud_detected": 1,
        "false_positives": 1,
        "false_positive_rate": 0.5,
    }


def test_replay_range_and_transactions_support_schema_without_step():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("created_at", DateTime),
        Column("amount", Float),
        Column("is_fraud", Boolean),
    )
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            transactions.insert(),
            [
                {
                    "transaction_id": "TX-2",
                    "created_at": None,
                    "amount": 300000,
                    "is_fraud": True,
                },
                {
                    "transaction_id": "TX-1",
                    "created_at": None,
                    "amount": 100000,
                    "is_fraud": False,
                },
                {
                    "transaction_id": "TX-3",
                    "created_at": None,
                    "amount": 400000,
                    "is_fraud": False,
                },
            ],
        )

    with Session(engine) as db:
        assert get_replay_step_range(db) == (1, 3)
        first_two = load_replay_transactions(db, 1, 2)
        only_second = load_replay_transactions(db, 2, 2)

    assert [row["amount"] for row in first_two] == [100000, 300000]
    assert len(only_second) == 1
    assert _get_operational_metrics(only_second, threshold=0.75)["fraud_detected"] == 1
    engine.dispose()
