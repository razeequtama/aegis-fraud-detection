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

from app.api.routes.transactions import get_transaction_details, get_transactions


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


@pytest.mark.parametrize(
    ("account_column", "time_column", "fraud_column", "fraud_type"),
    [
        ("account_id", "timestamp", "label", Integer),
        ("name_orig", "created_at", "is_fraud", Boolean),
    ],
)
def test_get_transaction_details_returns_transaction_signals_and_entities(
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
        Column("device_id", String),
        Column("session_id", String),
        Column("risk_signals", String),
    )
    case_table = Table(
        "investigation_cases",
        metadata,
        Column("case_id", String, primary_key=True),
        Column("transaction_id", String, nullable=False),
        Column("status", String),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(
            transaction_table.insert(),
            {
                "transaction_id": "TX-DETAIL",
                account_column: "ACC-DETAIL",
                time_column: datetime(2026, 1, 2, tzinfo=timezone.utc),
                "amount": 850.0,
                "type": "TRANSFER",
                fraud_column: 1 if fraud_type is Integer else True,
                "device_id": "DEV-DETAIL",
                "session_id": "SES-DETAIL",
                "risk_signals": '[{"name":"velocity","description":"Repeated transfers"}]',
            },
        )
        connection.execute(
            case_table.insert(),
            {"case_id": "CASE-DETAIL", "transaction_id": "TX-DETAIL", "status": "open"},
        )

    with Session(engine) as db:
        response = get_transaction_details("TX-DETAIL", db)

    details = response["data"]
    assert details["transaction"]["transaction_id"] == "TX-DETAIL"
    assert details["transaction"]["account_id"] == "ACC-DETAIL"
    assert details["risk_signals"] == [
        {"name": "velocity", "description": "Repeated transfers"}
    ]
    assert details["related_entities"]["account"] == {"id": "ACC-DETAIL"}
    assert details["related_entities"]["device"] == {"id": "DEV-DETAIL"}
    assert details["case"]["case_id"] == "CASE-DETAIL"
    engine.dispose()


def test_get_transactions_computes_real_ml_scores():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    table = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String, nullable=False),
        Column("amount", Float, nullable=False),
        Column("type", String),
        Column("oldbalance_org", Float),
        Column("newbalance_orig", Float),
        Column("oldbalance_dest", Float),
        Column("newbalance_dest", Float),
        Column("is_fraud", Integer),
    )
    metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            table.insert(),
            [
                {
                    "transaction_id": "TX-REAL-FRAUD",
                    "account_id": "ACC-RF-1",
                    "amount": 250000.0,
                    "type": "TRANSFER",
                    "oldbalance_org": 250000.0,
                    "newbalance_orig": 0.0,
                    "oldbalance_dest": 0.0,
                    "newbalance_dest": 0.0,
                    "is_fraud": 1,
                },
                {
                    "transaction_id": "TX-REAL-LEGIT",
                    "account_id": "ACC-RF-2",
                    "amount": 50.0,
                    "type": "PAYMENT",
                    "oldbalance_org": 1000.0,
                    "newbalance_orig": 950.0,
                    "oldbalance_dest": 0.0,
                    "newbalance_dest": 0.0,
                    "is_fraud": 0,
                },
            ],
        )

    with Session(engine) as db:
        res = get_transactions(page=1, limit=10, db=db)

    txs = {t["id"]: t for t in res["data"]}
    assert txs["TX-REAL-FRAUD"]["decision"] == "DECLINE"
    assert txs["TX-REAL-FRAUD"]["riskScore"] >= 0.75
    assert txs["TX-REAL-LEGIT"]["decision"] == "APPROVE"
    assert txs["TX-REAL-LEGIT"]["riskScore"] < 0.40
    engine.dispose()


def test_get_transactions_filters_by_risk_score_range():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    table = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String, nullable=False),
        Column("amount", Float, nullable=False),
        Column("type", String),
        Column("oldbalance_org", Float),
        Column("newbalance_orig", Float),
        Column("oldbalance_dest", Float),
        Column("newbalance_dest", Float),
        Column("is_fraud", Integer),
    )
    metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            table.insert(),
            [
                {
                    "transaction_id": "TX-HIGH-RISK",
                    "account_id": "ACC-HR",
                    "amount": 250000.0,
                    "type": "TRANSFER",
                    "oldbalance_org": 250000.0,
                    "newbalance_orig": 0.0,
                    "oldbalance_dest": 0.0,
                    "newbalance_dest": 0.0,
                    "is_fraud": 1,
                },
                {
                    "transaction_id": "TX-LOW-RISK",
                    "account_id": "ACC-LR",
                    "amount": 50.0,
                    "type": "PAYMENT",
                    "oldbalance_org": 1000.0,
                    "newbalance_orig": 950.0,
                    "oldbalance_dest": 0.0,
                    "newbalance_dest": 0.0,
                    "is_fraud": 0,
                },
            ],
        )

    with Session(engine) as db:
        # High risk filter (minRiskScore = 0.7)
        res_high = get_transactions(page=1, limit=10, min_risk_score=0.7, max_risk_score=1.0, db=db)
        # Low risk filter (maxRiskScore = 0.3)
        res_low = get_transactions(page=1, limit=10, min_risk_score=0.0, max_risk_score=0.3, db=db)
        # Narrow filter matching nothing
        res_empty = get_transactions(page=1, limit=10, min_risk_score=0.45, max_risk_score=0.55, db=db)

    assert len(res_high["data"]) == 1
    assert res_high["data"][0]["id"] == "TX-HIGH-RISK"

    assert len(res_low["data"]) == 1
    assert res_low["data"][0]["id"] == "TX-LOW-RISK"

    assert len(res_empty["data"]) == 0
    engine.dispose()


def test_get_transactions_escapes_like_wildcards():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    table = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column("account_id", String, nullable=False),
        Column("amount", Float, nullable=False),
        Column("type", String),
        Column("is_fraud", Integer),
    )
    metadata.create_all(engine)

    with engine.begin() as conn:
        conn.execute(
            table.insert(),
            [
                {"transaction_id": "TX-%1", "account_id": "ACC-LITERAL-PCT", "amount": 100.0, "type": "TRANSFER", "is_fraud": 0},
                {"transaction_id": "TX-100", "account_id": "ACC-STANDARD-1", "amount": 200.0, "type": "TRANSFER", "is_fraud": 0},
                {"transaction_id": "TX-200", "account_id": "ACC-STANDARD-2", "amount": 300.0, "type": "TRANSFER", "is_fraud": 0},
            ],
        )

    with Session(engine) as db:
        # Searching for literal percent 'TX-%' should only match TX-%1
        res_pct = get_transactions(search="TX-%", db=db)
        assert len(res_pct["data"]) == 1
        assert res_pct["data"][0]["id"] == "TX-%1"

        # Searching for bare '%' should match only literal percent 'TX-%1', NOT all 3 transactions
        res_bare_pct = get_transactions(search="%", db=db)
        assert len(res_bare_pct["data"]) == 1
        assert res_bare_pct["data"][0]["id"] == "TX-%1"

        # Searching for bare '_' should match 0 rows since no row has literal underscore
        res_underscore = get_transactions(search="_", db=db)
        assert len(res_underscore["data"]) == 0

        # Normal search for '100' should still match TX-100
        res_normal = get_transactions(search="100", db=db)
        assert len(res_normal["data"]) == 1
        assert res_normal["data"][0]["id"] == "TX-100"

    engine.dispose()
