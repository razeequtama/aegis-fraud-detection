from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
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

MIN_SYSTEM_DATE = date(2000, 1, 1)
MAX_HOURLY_SPAN_DAYS = 7
MAX_DAILY_SPAN_DAYS = 730


@router.get("/overview")
def get_metrics_overview(
    start_date: date | None = None,
    end_date: date | None = None,
    interval: str | None = None,
    db: Session = Depends(get_db),
):
    # Validate interval whitelist
    if interval is not None and interval not in ("hour", "day"):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid interval '{interval}'. Valid values are 'hour', 'day', or None.",
        )

    # Validate epoch and sanity boundaries
    if start_date is not None and start_date < MIN_SYSTEM_DATE:
        raise HTTPException(
            status_code=422,
            detail=f"start_date cannot be earlier than {MIN_SYSTEM_DATE.isoformat()}.",
        )

    max_future_date = date.today() + timedelta(days=365)
    if end_date is not None and end_date > max_future_date:
        raise HTTPException(
            status_code=422,
            detail=f"end_date cannot exceed future threshold {max_future_date.isoformat()}.",
        )

    if start_date and end_date:
        if start_date > end_date:
            raise HTTPException(
                status_code=422, detail="start_date must be on or before end_date."
            )
        requested_span = (end_date - start_date).days
        if interval == "hour" and requested_span > MAX_HOURLY_SPAN_DAYS:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Hourly metrics aggregation is limited to a maximum span of {MAX_HOURLY_SPAN_DAYS} days "
                    f"(requested {requested_span} days). Please select a shorter date range or use 'day' interval."
                ),
            )
        if requested_span > MAX_DAILY_SPAN_DAYS:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Date range span of {requested_span} days exceeds the maximum allowed limit "
                    f"of {MAX_DAILY_SPAN_DAYS} days (2 years)."
                ),
            )

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
            (
                func.min(timestamp_column)
                if timestamp_column is not None
                else literal(None)
            ).label("earliest_transaction"),
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
    available_range = None
    busiest_period = None
    latest_transaction = totals["latest_transaction"]
    earliest_transaction = totals["earliest_transaction"]
    is_hourly = False
    if (
        timestamp_column is not None
        and latest_transaction is not None
        and earliest_transaction is not None
    ):
        def as_date(value):
            return (
                value.date()
                if isinstance(value, datetime)
                else date.fromisoformat(str(value)[:10])
            )

        available_start = as_date(earliest_transaction)
        available_end = as_date(latest_transaction)
        selected_start = start_date or available_start
        selected_end = end_date or available_end
        available_range = {
            "start_date": available_start.isoformat(),
            "end_date": available_end.isoformat(),
        }

        span_days = (selected_end - selected_start).days
        if span_days < 0:
            raise HTTPException(
                status_code=422, detail="start_date must be on or before end_date."
            )

        if interval == "hour":
            if span_days > MAX_HOURLY_SPAN_DAYS:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Hourly metrics aggregation is limited to a maximum span of {MAX_HOURLY_SPAN_DAYS} days "
                        f"(requested {span_days} days). Please select a shorter date range or use 'day' interval."
                    ),
                )
            is_hourly = True
        else:
            is_hourly = interval != "day" and start_date is not None and span_days <= 2
            if span_days > MAX_DAILY_SPAN_DAYS:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Date range span of {span_days} days exceeds the maximum allowed limit "
                        f"of {MAX_DAILY_SPAN_DAYS} days (2 years)."
                    ),
                )

        dialect = db.get_bind().dialect.name
        if dialect == "postgresql":
            bucket = func.date_trunc("hour" if is_hourly else "day", timestamp_column)
            month_bucket = func.date_trunc("month", timestamp_column)
        elif dialect == "sqlite":
            bucket = func.strftime("%Y-%m-%dT%H:00:00" if is_hourly else "%Y-%m-%d", timestamp_column)
            month_bucket = func.strftime("%Y-%m", timestamp_column)
        else:
            raise RuntimeError(
                f"Daily metrics time-series are not supported for database dialect {dialect!r}."
            )

        trend_query = (
            select(
                bucket.label("bucket"),
                func.count().label("transactions"),
                func.coalesce(
                    func.sum(case((fraud_condition, 1), else_=0)), 0
                ).label("suspicious"),
            )
            .select_from(transactions)
            .where(timestamp_column.is_not(None))
            .where(timestamp_column >= datetime.combine(selected_start, time.min))
            .where(
                timestamp_column
                < datetime.combine(selected_end + timedelta(days=1), time.min)
            )
            .group_by(bucket)
            .order_by(bucket)
        )
        rows = db.execute(trend_query).mappings().all()

        if is_hourly:
            hourly_map = {}
            for row in rows:
                h = row["bucket"]
                if isinstance(h, datetime):
                    key = h.strftime("%Y-%m-%dT%H:00:00")
                else:
                    key = str(h)[:19]
                hourly_map[key] = {
                    "transactions": row["transactions"],
                    "suspicious": row["suspicious"],
                }

            trend = []
            cur = datetime.combine(selected_start, time.min)
            end_limit = datetime.combine(selected_end + timedelta(days=1), time.min)
            while cur < end_limit:
                k = cur.strftime("%Y-%m-%dT%H:00:00")
                vals = hourly_map.get(k, {"transactions": 0, "suspicious": 0})
                trend.append({
                    "date": k,
                    "transactions": vals["transactions"],
                    "suspicious": vals["suspicious"],
                })
                cur += timedelta(hours=1)
        else:
            daily_metrics: dict[date, dict[str, int]] = {}
            for row in rows:
                day = as_date(row["bucket"])
                daily_metrics[day] = {
                    "transactions": row["transactions"],
                    "suspicious": row["suspicious"],
                }

            trend = [
                {
                    "date": day.isoformat(),
                    "transactions": values["transactions"],
                    "suspicious": values["suspicious"],
                }
                for day, values in sorted(daily_metrics.items())
            ]

        busiest_month_row = db.execute(
            select(
                month_bucket.label("month"),
                func.count().label("transactions"),
                func.min(timestamp_column).label("first_transaction"),
                func.max(timestamp_column).label("last_transaction"),
            )
            .select_from(transactions)
            .where(timestamp_column.is_not(None))
            .group_by(month_bucket)
            .order_by(func.count().desc(), month_bucket)
            .limit(1)
        ).mappings().first()
        if busiest_month_row is not None:
            busiest_period = {
                "start_date": as_date(
                    busiest_month_row["first_transaction"]
                ).isoformat(),
                "end_date": as_date(
                    busiest_month_row["last_transaction"]
                ).isoformat(),
                "transactions": busiest_month_row["transactions"],
            }

    model_loaded = risk_engine.model is not None
    return {
        "metrics": {
            "total_transactions": totals["total_transactions"],
            "review_queue_count": review_queue_count,
            "detected_frauds": totals["detected_frauds"],
            "model_status": "online" if model_loaded else "unavailable",
            "model_version": risk_engine.model_version if model_loaded else None,
        },
        "trend": trend,
        "available_range": available_range,
        "busiest_period": busiest_period,
        "granularity": "hourly" if is_hourly else "daily",
    }
