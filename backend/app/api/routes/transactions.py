from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import MetaData, String, Table, cast, func, literal, select
from typing import Optional

from app.db.session import get_db

router = APIRouter()


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