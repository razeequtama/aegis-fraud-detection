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

from app.api.routes.transactions import get_transactions


@pytest.mark.parametrize(
    ("account_column", "time_column", "fraud_column", "fraud_type"),
    [
        ("account_id", "timestamp", "label", Integer),
        ("name_orig", "created_at", "is_fraud", Boolean),
    ],
)
def test_get_transactions_supports_existing_table_layouts(
    account_column, time_column, fraud_column, fraud_type
):
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transaction_table = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column(account_column, String, nullable=False),
        Column(time_column, DateTime(timezone=True)),
        Column("amount", Float, nullable=False),
        Column("type", String),
        Column(fraud_column, fraud_type),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(
            transaction_table.insert(),
            [
                {
                    "transaction_id": "TX-LEGIT",
                    account_column: "ACC-001",
                    time_column: datetime(2026, 1, 1, tzinfo=timezone.utc),
                    "amount": 125.5,
                    "type": "TRANSFER",
                    fraud_column: 0 if fraud_type is Integer else False,
                },
                {
                    "transaction_id": "TX-FRAUD",
                    account_column: "ACC-002",
                    time_column: datetime(2026, 1, 2, tzinfo=timezone.utc),
                    "amount": 250.0,
                    "type": "TRANSFER",
                    fraud_column: 1 if fraud_type is Integer else True,
                },
                {
                    "transaction_id": "TX-APPROVED-CASHOUT",
                    account_column: "ACC-003",
                    time_column: datetime(2026, 1, 3, tzinfo=timezone.utc),
                    "amount": 300.0,
                    "type": "CASH_OUT",
                    fraud_column: 0 if fraud_type is Integer else False,
                },
                {
                    "transaction_id": "TX-APPROVED-PAYMENT",
                    account_column: "ACC-004",
                    time_column: datetime(2026, 1, 4, tzinfo=timezone.utc),
                    "amount": 350.0,
                    "type": "PAYMENT",
                    fraud_column: 0 if fraud_type is Integer else False,
                },
            ],
        )

    with Session(engine) as db:
        response = get_transactions(
            page=1,
            limit=10,
            search=None,
            decision=None,
            transaction_type=None,
            db=db,
        )
        declined = get_transactions(
            page=1,
            limit=10,
            search="TX-FRAUD",
            decision="DECLINE",
            transaction_type="TRANSFER",
            db=db,
        )
        approved_transfers = get_transactions(
            page=1,
            limit=10,
            search=None,
            decision="APPROVE",
            transaction_type="TRANSFER",
            db=db,
        )

    assert {transaction["id"] for transaction in response["data"]} == {
        "TX-APPROVED-PAYMENT",
        "TX-APPROVED-CASHOUT",
        "TX-FRAUD",
        "TX-LEGIT",
    }
    transactions_by_id = {
        transaction["id"]: transaction for transaction in response["data"]
    }
    assert transactions_by_id["TX-FRAUD"]["account"] == "ACC-002"
    assert transactions_by_id["TX-FRAUD"]["decision"] == "DECLINE"
    assert transactions_by_id["TX-LEGIT"]["decision"] == "APPROVE"
    assert declined["data"][0]["id"] == "TX-FRAUD"
    assert [transaction["id"] for transaction in approved_transfers["data"]] == [
        "TX-LEGIT"
    ]
    engine.dispose()
