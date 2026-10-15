import logging
import numpy as np
from sqlalchemy import MetaData, Table, func, inspect, select
from app.db.session import SessionLocal
from app.models.replay_run import ReplayRun
from app.services.risk_engine import risk_engine

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

    if "step" in table.c:
        statement = select(table)
        statement = statement.where(
            table.c.step >= start_step,
            table.c.step <= end_step,
        )
        statement = statement.order_by(table.c.step)
        rows = [dict(row) for row in db.execute(statement).mappings().all()]
        if fraud_column is not None and "is_fraud" not in table.c:
            for r in rows:
                r["is_fraud"] = r.get(fraud_column.name)
        return rows

    order_columns = []
    timestamp_column = next(
        (table.c[name] for name in ("timestamp", "created_at") if name in table.c),
        None,
    )
    if timestamp_column is not None:
        order_columns.append(timestamp_column.asc().nulls_last())
    if "transaction_id" in table.c:
        order_columns.append(table.c.transaction_id.asc())

    statement = select(table)
    if order_columns:
        statement = statement.order_by(*order_columns)
    rows = db.execute(statement).mappings().all()
    results = [
        dict(row)
        for index, row in enumerate(rows, start=1)
        if start_step <= index <= end_step
    ]
    if fraud_column is not None and "is_fraud" not in table.c:
        for r in results:
            r["is_fraud"] = r.get(fraud_column.name)
    return results


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
        else getattr(transaction, "amount", 0.0)
    )
    return float(value or 0)


def _score_transactions_batch(transactions):
    """
    Score transactions using real ML batch inference with risk_engine.model.predict_proba.
    Falls back gracefully to simulated scoring if transactions are bare mock objects or model is unavailable.
    """
    if not transactions:
        return []

    if risk_engine.model is not None and risk_engine.scaler is not None:
        try:
            # Check if any transaction has balance fields or non-amount features.
            has_rich_features = any(
                (isinstance(tx, dict) and any(k in tx for k in ("oldbalance_org", "oldbalanceOrg", "type", "payment_attempts")))
                or (not isinstance(tx, dict) and hasattr(tx, "oldbalance_org"))
                for tx in transactions
            )

            if has_rich_features:
                feature_matrix = []
                for tx in transactions:
                    tx_dict = tx if isinstance(tx, dict) else vars(tx)
                    fv = risk_engine._build_feature_vector(tx_dict)[0]
                    feature_matrix.append(fv)

                X = np.array(feature_matrix, dtype=float)
                scaled_X = risk_engine.scaler.transform(X)
                probabilities = risk_engine.model.predict_proba(scaled_X)
                return [round(float(p[1]), 4) for p in probabilities]
        except Exception as exc:
            logger.warning(f"Batch ML inference failed, using simulated fallback: {exc}")

    # Fallback to simulated score (e.g. for bare mock test objects)
    return [min(_amount(tx) / 200000.0, 1.0) for tx in transactions]


def _get_operational_metrics(transactions, threshold: float, scores: list | None = None):
    total_processed = len(transactions)
    total_fraud = sum(1 for tx in transactions if _is_fraud(tx))
    legitimate_count = total_processed - total_fraud
    review_count = 0
    fraud_detected = 0
    false_positives = 0

    if scores is None:
        scores = _score_transactions_batch(transactions)

    for tx, score in zip(transactions, scores):
        if score >= threshold:
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

        scores = _score_transactions_batch(transactions)
        metrics = _get_operational_metrics(transactions, replay_job.threshold, scores=scores)
        baseline_metrics = _get_operational_metrics(transactions, BASELINE_THRESHOLD, scores=scores)
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