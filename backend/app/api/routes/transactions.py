from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import MetaData, String, Table, cast, func, inspect, literal, select
from typing import Optional

from app.db.session import get_db

router = APIRouter()


def _serialize_value(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return str(value)


def _related_entity(db: Session, table_name: str, key_column: str, entity_id):
    if entity_id is None or table_name not in inspect(db.get_bind()).get_table_names():
        return {"id": _serialize_value(entity_id)} if entity_id is not None else None

    table = Table(table_name, MetaData(), autoload_with=db.get_bind())
    if key_column not in table.c:
        return {"id": _serialize_value(entity_id)}

    row = db.execute(
        select(table).where(table.c[key_column] == entity_id).limit(1)
    ).mappings().first()
    if row is None:
        return {"id": _serialize_value(entity_id)}
    safe_columns = {
        key_column,
        "status",
        "created_at",
        "first_seen",
        "last_seen",
    }
    return {
        key: _serialize_value(value)
        for key, value in row.items()
        if key in safe_columns
    }


@router.get("/transactions/{transaction_id}")
def get_transaction_details(transaction_id: str, db: Session = Depends(get_db)):
    table = Table("transactions", MetaData(), autoload_with=db.get_bind())
    if "transaction_id" not in table.c:
        raise HTTPException(status_code=500, detail="The transactions table has no transaction_id column.")

    row = db.execute(
        select(table).where(
            cast(table.c.transaction_id, String) == transaction_id
        ).limit(1)
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    values = dict(row)
    account_column = next(
        (name for name in ("account_id", "name_orig") if name in values), None
    )
    device_column = next(
        (name for name in ("device_id", "name_device") if name in values), None
    )
    session_column = next(
        (name for name in ("session_id", "session") if name in values), None
    )
    timestamp_column = next(
        (name for name in ("timestamp", "created_at") if name in values), None
    )
    label_column = next(
        (name for name in ("label", "is_fraud", "is_flagged_fraud") if name in values),
        None,
    )
    signal_column = next(
        (name for name in ("risk_signals", "signals") if name in values), None
    )

    risk_signals = []
    if signal_column and values[signal_column]:
        raw_signals = values[signal_column]
        if isinstance(raw_signals, str):
            import json

            try:
                raw_signals = json.loads(raw_signals)
            except json.JSONDecodeError:
                raw_signals = []
        risk_signals = raw_signals if isinstance(raw_signals, list) else [raw_signals]

    case = None
    if "investigation_cases" in inspect(db.get_bind()).get_table_names():
        case_table = Table("investigation_cases", MetaData(), autoload_with=db.get_bind())
        if {"case_id", "transaction_id"}.issubset(case_table.c.keys()):
            case_query = select(case_table).where(
                cast(case_table.c.transaction_id, String) == transaction_id
            )
            if "updated_at" in case_table.c:
                case_query = case_query.order_by(case_table.c.updated_at.desc().nulls_last())
            case_row = db.execute(case_query.limit(1)).mappings().first()
            if case_row:
                case = {
                    key: _serialize_value(value)
                    for key, value in case_row.items()
                }

    transaction = {
        "transaction_id": transaction_id,
        "timestamp": _serialize_value(values.get(timestamp_column)) if timestamp_column else None,
        "amount": _serialize_value(values.get("amount")),
        "type": _serialize_value(values.get("type")),
        "account_id": _serialize_value(values.get(account_column)) if account_column else None,
        "device_id": _serialize_value(values.get(device_column)) if device_column else None,
        "session_id": _serialize_value(values.get(session_column)) if session_column else None,
        "label": _serialize_value(values.get(label_column)) if label_column else None,
        "risk_score": _serialize_value(values.get("risk_score")) if "risk_score" in values else None,
        "decision": _serialize_value(values.get("decision")) if "decision" in values else None,
        "model_version": _serialize_value(values.get("model_version")) if "model_version" in values else None,
    }
    related_entities = {
        "account": _related_entity(
            db, "accounts", "account_id", values.get(account_column) if account_column else None
        ),
        "device": _related_entity(
            db, "devices", "device_id", values.get(device_column) if device_column else None
        ),
        "session": (
            {"id": _serialize_value(values.get(session_column))}
            if session_column and values.get(session_column) is not None
            else None
        ),
    }
    return {
        "data": {
            "transaction": transaction,
            "risk_signals": risk_signals,
            "related_entities": related_entities,
            "case": case,
        }
    }


@router.get("/transactions")
def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    decision: Optional[str] = None,
    transaction_type: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * limit

    transaction_table = Table(
        "transactions", MetaData(), autoload_with=db.get_bind()
    )
    columns = transaction_table.c
    account_column = next(
        (columns[name] for name in ("account_id", "name_orig") if name in columns),
        None,
    )
    timestamp_column = next(
        (columns[name] for name in ("timestamp", "created_at") if name in columns),
        None,
    )
    fraud_column = next(
        (
            columns[name]
            for name in ("is_fraud", "label", "is_flagged_fraud")
            if name in columns
        ),
        None,
    )

    if (
        "transaction_id" not in columns
        or account_column is None
        or "amount" not in columns
    ):
        raise HTTPException(
            status_code=500,
            detail="The transactions table is missing required transaction, account, or amount columns.",
        )

    fraud_condition = (
        func.lower(cast(fraud_column, String)).in_(
            ("1", "true", "t", "yes", "fraud", "decline")
        )
        if fraud_column is not None
        else literal(False)
    )
    statement = select(
        columns.transaction_id.label("id"),
        (timestamp_column if timestamp_column is not None else literal(None)).label(
            "time"
        ),
        account_column.label("account"),
        (columns["type"] if "type" in columns else literal("TRANSFER")).label("type"),
        columns.amount.label("amount"),
        fraud_condition.label("is_fraud"),
    )

    type_column = columns["type"] if "type" in columns else literal("TRANSFER")
    if transaction_type:
        statement = statement.where(
            func.upper(cast(type_column, String)) == transaction_type.upper()
        )

    if search:
        search_pattern = f"%{search}%"
        statement = statement.where(
            cast(columns.transaction_id, String).ilike(search_pattern)
            | cast(account_column, String).ilike(search_pattern)
        )

    if decision:
        normalized_decision = decision.upper()
        if normalized_decision == "APPROVE":
            statement = statement.where(~fraud_condition)
        elif normalized_decision == "DECLINE":
            statement = statement.where(fraud_condition)
        elif normalized_decision == "REVIEW":
            statement = statement.where(literal(False))
        else:
            raise HTTPException(
                status_code=400,
                detail="Decision must be APPROVE, REVIEW, or DECLINE.",
            )

    if timestamp_column is not None:
        statement = statement.order_by(timestamp_column.desc().nulls_last())
    statement = statement.limit(limit).offset(offset)

    result = db.execute(statement).mappings().all()

    formatted_data = []
    for row in result:
        is_fraud = row["is_fraud"]
        if is_fraud:
            risk_score = 0.88
            dec = "DECLINE"
        else:
            risk_score = 0.15
            dec = "APPROVE"

        formatted_data.append(
            {
                "id": row["id"],
                "time": str(row["time"]) if row["time"] is not None else "N/A",
                "account": row["account"],
                "type": row["type"],
                "amount": f"Rp {row['amount']:,.2f}",
                "riskScore": risk_score,
                "decision": dec,
            }
        )

    return {
        "page": page,
        "limit": limit,
        "data": formatted_data,
    }