import logging
from app.db.session import SessionLocal
from app.models.replay_run import ReplayRun
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

def run_historical_replay(replay_id: int):
    # Buat sesi database mandiri khusus untuk background worker
    db = SessionLocal()
    try:
        replay_job = db.query(ReplayRun).filter(ReplayRun.id == replay_id).first()
        if not replay_job:
            return

        replay_job.status = "RUNNING"
        db.commit()

        # Fetch historical transactions within the step range
        transactions = db.query(Transaction).filter(
            Transaction.step >= replay_job.start_step,
            Transaction.step <= replay_job.end_step
        ).all()

        total_processed = len(transactions)
        review_count = 0
        fraud_detected = 0
        false_positives = 0

        for tx in transactions:
            simulated_score = min(float(tx.amount) / 200000.0, 1.0)
            
            is_review = simulated_score >= replay_job.threshold
            if is_review:
                review_count += 1
                if tx.is_fraud == 1:
                    fraud_detected += 1
                else:
                    false_positives += 1

        replay_job.metrics_summary = {
            "total_processed": total_processed,
            "review_count": review_count,
            "fraud_detected": fraud_detected,
            "false_positives": false_positives
        }
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