from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import (
    MetaData,
    String,
    Table,
    cast,
    case,
    func,
    inspect,
    literal,
    select,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.risk_engine import risk_engine

router = APIRouter(prefix="/api/v1/metrics", tags=["Metrics"])


@router.get("/overview")
def get_metrics_overview(db: Session = Depends(get_db)):
    metadata = MetaData()
    transactions = Table("transactions", metadata, autoload_with=db.get_bind())
    columns = transactions.c
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
    fraud_condition = (
        func.lower(cast(fraud_column, String)).in_(
            ("1", "true", "t", "yes", "fraud", "decline")
        )
        if fraud_column is not None
        else literal(False)
    )

    totals = db.execute(
        select(
            func.count().label("total_transactions"),
            func.coalesce(
                func.sum(case((fraud_condition, 1), else_=0)), 0
            ).label("detected_frauds"),
            (
                func.max(timestamp_column)
                if timestamp_column is not None
                else literal(None)
            ).label("latest_transaction"),
        ).select_from(transactions)
    ).mappings().one()

    review_queue_count = 0
    if "investigation_cases" in inspect(db.get_bind()).get_table_names():
        cases = Table(
            "investigation_cases", metadata, autoload_with=db.get_bind()
        )
        if "status" in cases.c:
            review_queue_count = db.execute(
                select(func.count())
                .select_from(cases)
                .where(func.lower(cases.c.status).in_(("open", "in_review")))
            ).scalar_one()

    trend = []
    latest_transaction = totals["latest_transaction"]
    if timestamp_column is not None and latest_transaction is not None:
        dialect = db.get_bind().dialect.name
        if dialect == "postgresql":
            bucket = func.date_trunc("day", timestamp_column)
        elif dialect == "sqlite":
            bucket = func.strftime("%Y-%m-%d", timestamp_column)
        else:
            raise RuntimeError(
                f"Daily metrics time-series are not supported for database dialect {dialect!r}."
            )

        rows = db.execute(
            select(
                bucket.label("day"),
                func.count().label("transactions"),
                func.coalesce(
                    func.sum(case((fraud_condition, 1), else_=0)), 0
                ).label("suspicious"),
            )
            .select_from(transactions)
            .where(timestamp_column.is_not(None))
            .group_by(bucket)
            .order_by(bucket)
        ).mappings()

        daily_metrics: dict[date, dict[str, int]] = {}
        for row in rows:
            day_value = row["day"]
            day = (
                day_value.date()
                if isinstance(day_value, datetime)
                else date.fromisoformat(day_value)
            )
            daily_metrics[day] = {
                "transactions": row["transactions"],
                "suspicious": row["suspicious"],
            }

        latest_day = (
            latest_transaction.date()
            if isinstance(latest_transaction, datetime)
            else date.fromisoformat(latest_transaction)
        )
        first_day = latest_day - timedelta(days=13)
        trend = [
            {
                "date": (first_day + timedelta(days=offset)).isoformat(),
                **daily_metrics.get(
                    first_day + timedelta(days=offset),
                    {"transactions": 0, "suspicious": 0},
                ),
            }
            for offset in range(14)
        ]

    model_loaded = risk_engine.model is not None
    return {
        "metrics": {
            "total_transactions": totals["total_transactions"],
            "review_queue_count": review_queue_count,
            "detected_frauds": totals["detected_frauds"],
            "model_status": "online" if model_loaded else "unavailable",
            "model_version": "aegis-rf-v1.0" if model_loaded else None,
        },
        "trend": trend,
    }
