import logging
from sqlalchemy import MetaData, Table, func, inspect, select
from app.db.session import SessionLocal
from app.models.replay_run import ReplayRun

logger = logging.getLogger(__name__)

BASELINE_THRESHOLD = 0.75


def get_replay_step_range(db):
    if "transactions" not in inspect(db.get_bind()).get_table_names():
        return None, None

    table = Table("transactions", MetaData(), autoload_with=db.get_bind())
    if "step" in table.c:
        minimum, maximum = db.execute(
            select(func.min(table.c.step), func.max(table.c.step))
        ).one()
        return minimum, maximum

    count = db.execute(select(func.count()).select_from(table)).scalar_one()
    return (1, count) if count else (None, None)


def load_replay_transactions(db, start_step: int, end_step: int):
    if "transactions" not in inspect(db.get_bind()).get_table_names():
        return []

    table = Table("transactions", MetaData(), autoload_with=db.get_bind())
    if "amount" not in table.c:
        raise ValueError("The transactions table has no amount column.")

    fraud_column = next(
        (
            table.c[name]
            for name in ("is_fraud", "label", "is_flagged_fraud")
            if name in table.c
        ),
        None,
    )
    selected = [
        table.c.amount.label("amount"),
        fraud_column.label("is_fraud") if fraud_column is not None else None,
    ]

    if "step" in table.c:
        statement = select(*(column for column in selected if column is not None))
        statement = statement.where(
            table.c.step >= start_step,
            table.c.step <= end_step,
        )
        statement = statement.order_by(table.c.step)
        return [dict(row) for row in db.execute(statement).mappings().all()]

    order_columns = []
    timestamp_column = next(
        (table.c[name] for name in ("timestamp", "created_at") if name in table.c),
        None,
    )
    if timestamp_column is not None:
        order_columns.append(timestamp_column.asc().nulls_last())
    if "transaction_id" in table.c:
        order_columns.append(table.c.transaction_id.asc())
    statement = select(*(column for column in selected if column is not None))
    if order_columns:
        statement = statement.order_by(*order_columns)
    rows = db.execute(statement).mappings().all()
    return [
        dict(row)
        for index, row in enumerate(rows, start=1)
        if start_step <= index <= end_step
    ]


def _is_fraud(transaction):
    value = (
        transaction.get("is_fraud")
        if isinstance(transaction, dict)
        else getattr(transaction, "is_fraud", None)
    )
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {
        "1",
        "true",
        "t",
        "yes",
        "fraud",
        "confirmed_fraud",
        "decline",
    }


def _amount(transaction):
    value = (
        transaction.get("amount")
        if isinstance(transaction, dict)
        else getattr(transaction, "amount")
    )
    return float(value or 0)


def _get_operational_metrics(transactions, threshold: float):
    total_processed = len(transactions)
    total_fraud = sum(1 for tx in transactions if _is_fraud(tx))
    legitimate_count = total_processed - total_fraud
    review_count = 0
    fraud_detected = 0
    false_positives = 0

    for tx in transactions:
        simulated_score = min(_amount(tx) / 200000.0, 1.0)
        if simulated_score >= threshold:
            review_count += 1
            if _is_fraud(tx):
                fraud_detected += 1
            else:
                false_positives += 1

    return {
        "total_processed": total_processed,
        "review_count": review_count,
        "fraud_detected": fraud_detected,
        "false_positives": false_positives,
        "false_positive_rate": (
            false_positives / legitimate_count if legitimate_count else 0.0
        ),
    }


def run_historical_replay(replay_id: int):
    # Buat sesi database mandiri khusus untuk background worker
    db = SessionLocal()
    try:
        replay_job = db.query(ReplayRun).filter(ReplayRun.id == replay_id).first()
        if not replay_job:
            return

        replay_job.status = "RUNNING"
        db.commit()

        transactions = load_replay_transactions(
            db, replay_job.start_step, replay_job.end_step
        )

        metrics = _get_operational_metrics(transactions, replay_job.threshold)
        baseline_metrics = _get_operational_metrics(transactions, BASELINE_THRESHOLD)
        baseline_review_count = baseline_metrics["review_count"]
        metrics.update(
            {
                "baseline_review_count": baseline_review_count,
                "review_queue_difference": metrics["review_count"]
                - baseline_review_count,
                "review_queue_difference_percent": (
                    (metrics["review_count"] - baseline_review_count)
                    / baseline_review_count
                    * 100
                    if baseline_review_count
                    else None
                ),
                "baseline_threshold": BASELINE_THRESHOLD,
            }
        )
        replay_job.metrics_summary = metrics
        replay_job.status = "COMPLETED"
        db.commit()

    except Exception as e:
        logger.error(f"Replay job {replay_id} failed: {str(e)}")
        db.rollback()
        # Update status to FAILED in a separate try block or safe state
        try:
            replay_job = db.query(ReplayRun).filter(ReplayRun.id == replay_id).first()
            if replay_job:
                replay_job.status = "FAILED"
                replay_job.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()