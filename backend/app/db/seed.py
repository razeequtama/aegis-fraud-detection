import os
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text

from app.db.session import engine


def find_seed_csv_path() -> Path | None:
    env_path = os.getenv("SEED_DATA_PATH")
    if env_path and Path(env_path).is_file():
        return Path(env_path)

    candidates = [
        Path("/database/seeds/transactions.csv.gz"),
        Path(__file__).resolve().parents[3] / "database" / "seeds" / "transactions.csv.gz",
        Path(__file__).resolve().parents[2] / "database" / "seeds" / "transactions.csv.gz",
        Path("database/seeds/transactions.csv.gz").resolve(),
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def find_paysim_csv_path() -> Path | None:
    candidates = [
        Path("/ml/data/ps.csv"),
        Path(__file__).resolve().parents[3] / "ml" / "data" / "ps.csv",
        Path(__file__).resolve().parents[2] / "ml" / "data" / "ps.csv",
        Path("ml/data/ps.csv").resolve(),
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def seed_investigation_cases():
    sample_cases = [
        {
            "case_id": "CASE-100463",
            "transaction_id": "TX-100463",
            "assigned_analyst": "Senior Analyst",
            "status": "closed",
            "notes": "Shared emulator DEV-SIM-995 links 53 accounts with 17 flagged fraud nodes.",
            "feedback_label": "confirmed_fraud",
            "feedback_reasoning": "Analyst selected: Confirm Fraud",
        },
        {
            "case_id": "CASE-100002",
            "transaction_id": "TX-100002",
            "assigned_analyst": "Unassigned",
            "status": "closed",
            "notes": "Rapid full balance transfer with drain anomaly.",
            "feedback_label": "confirmed_fraud",
            "feedback_reasoning": "Analyst selected: Confirm Fraud",
        },
        {
            "case_id": "CASE-100033",
            "transaction_id": "TX-100033",
            "assigned_analyst": "Risk Analyst",
            "status": "closed",
            "notes": "Rapid outbound transfer on shared emulator DEV-SIM-278.",
            "feedback_label": "inconclusive",
            "feedback_reasoning": "Analyst selected: Inconclusive",
        },
        {
            "case_id": "CASE-100001",
            "transaction_id": "TX-100001",
            "assigned_analyst": "Compliance Analyst",
            "status": "closed",
            "notes": "Clean retail merchant payment with zero anomaly signals.",
            "feedback_label": "legitimate",
            "feedback_reasoning": "Customer identity and transaction receipt confirmed authentic.",
        },
        {
            "case_id": "CASE-149954",
            "transaction_id": "TX-149954",
            "assigned_analyst": "Compliance Analyst",
            "status": "closed",
            "notes": "Clean retail merchant payment with zero anomaly signals.",
            "feedback_label": "legitimate",
            "feedback_reasoning": "Customer identity and transaction receipt confirmed authentic.",
        },
        {
            "case_id": "CASE-140135",
            "transaction_id": "TX-140135",
            "assigned_analyst": "Fraud Specialist",
            "status": "open",
            "notes": "Critical cash out with 100% account drain on emulator DEV-SIM-360.",
            "feedback_label": None,
            "feedback_reasoning": None,
        },
        {
            "case_id": "CASE-14437",
            "transaction_id": "TX-140223",
            "assigned_analyst": "Analyst",
            "status": "closed",
            "notes": None,
            "feedback_label": "confirmed_fraud",
            "feedback_reasoning": "Analyst selected: Confirm Fraud",
        },
        {
            "case_id": "CASE-30693",
            "transaction_id": "TX-119057",
            "assigned_analyst": "Analyst",
            "status": "closed",
            "notes": None,
            "feedback_label": "inconclusive",
            "feedback_reasoning": "Analyst selected: Inconclusive",
        },
        {
            "case_id": "CASE-62544",
            "transaction_id": "TX-146603",
            "assigned_analyst": "Analyst",
            "status": "closed",
            "notes": None,
            "feedback_label": "legitimate",
            "feedback_reasoning": "Analyst selected: Mark Legitimate",
        },
    ]

    print("Seeding initial investigation cases...")
    inserted = 0
    with engine.begin() as conn:
        for case in sample_cases:
            exists = conn.execute(
                text("SELECT 1 FROM transactions WHERE transaction_id = :tx_id"),
                {"tx_id": case["transaction_id"]},
            ).scalar()
            if exists:
                conn.execute(
                    text("""
                        INSERT INTO investigation_cases (
                            case_id, transaction_id, assigned_analyst, status, notes, feedback_label, feedback_reasoning
                        ) VALUES (
                            :case_id, :transaction_id, :assigned_analyst, :status, :notes, :feedback_label, :feedback_reasoning
                        )
                        ON CONFLICT (case_id) DO NOTHING;
                    """),
                    case,
                )
                inserted += 1

    print(f"Successfully seeded {inserted} investigation cases!")

    print("Populating all review-needed transactions into investigation cases...")
    with engine.begin() as conn:
        review_cases_query = text("""
            INSERT INTO investigation_cases (case_id, transaction_id, assigned_analyst, status, notes, updated_at)
            SELECT
                'CASE-' || REPLACE(transaction_id, 'TX-', ''),
                transaction_id,
                'Unassigned',
                'open',
                'Moderate risk pattern (risk score ' || ROUND(CAST(risk_score AS numeric), 2) || ') flagged for analyst inspection.',
                COALESCE(timestamp, NOW())
            FROM transactions
            WHERE risk_score >= 0.40 AND risk_score < 0.75
              AND transaction_id NOT IN (SELECT transaction_id FROM investigation_cases WHERE transaction_id IS NOT NULL)
        """)
        res = conn.execute(review_cases_query)
        print(f"Populated {res.rowcount} review-needed transactions into investigation cases.")


def seed_database_from_csv(csv_path: str, sample_size: int = 50000):
    print(f"Loading raw dataset from {csv_path}...")
    df = pd.read_csv(csv_path)

    fraud_df = df[df['isFraud'] == 1]
    legit_df = df[df['isFraud'] == 0].sample(
        n=min(sample_size - len(fraud_df), len(df[df['isFraud'] == 0])), 
        random_state=42
    )
    sampled_df = pd.concat([fraud_df, legit_df]).sample(frac=1, random_state=42).reset_index(drop=True)

    base_time = datetime(2026, 1, 1, 0, 0, 0)
    transactions_data = []
    for idx, row in sampled_df.iterrows():
        tx_id = f"TX-{100000 + idx}"
        tx_timestamp = base_time + timedelta(hours=int(row['step']))
        transactions_data.append({
            "transaction_id": tx_id,
            "account_id": str(row['nameOrig']),
            "timestamp": tx_timestamp,
            "amount": float(row['amount']),
            "type": str(row.get('type', 'TRANSFER')).upper(),
            "oldbalance_org": float(row.get('oldbalanceOrg', 0.0)),
            "newbalance_orig": float(row.get('newbalanceOrig', 0.0)),
            "oldbalance_dest": float(row.get('oldbalanceDest', 0.0)),
            "newbalance_dest": float(row.get('newbalanceDest', 0.0)),
            "device_id": f"DEV-SIM-{abs(hash(row['nameOrig'])) % 1000}",
            "session_id": f"SES-SIM-{idx}",
            "payment_attempts": 1,
            "is_fraud": int(row['isFraud']),
        })

    tx_df = pd.DataFrame(transactions_data)

    print("Computing real ML + pattern continuous risk scores...")
    from app.services.risk_engine import risk_engine
    feature_matrix = [risk_engine._build_feature_vector(r)[0] for _, r in tx_df.iterrows()]
    matrix = np.array(feature_matrix, dtype=float)
    tx_df["risk_score"] = risk_engine.predict_proba_batch(matrix)

    print(f"Inserting {len(tx_df)} rows into PostgreSQL database...")
    with engine.begin() as connection:
        tx_df.to_sql('transactions', con=connection, if_exists='append', index=False, method='multi', chunksize=5000)

    print(f"Successfully seeded {len(tx_df)} rows into PostgreSQL database!")


def seed_if_empty():
    """Check if the database has data; if empty, seed automatically."""
    try:
        with engine.connect() as conn:
            tx_count = conn.execute(text("SELECT count(*) FROM transactions")).scalar() or 0
    except Exception as exc:
        print(f"Notice: Could not inspect transactions table (migrations may be pending): {exc}")
        return

    if tx_count > 0:
        print(f"Database already contains {tx_count} transactions. Skipping initial seed.")
        seed_investigation_cases()
        return

    print("Database is empty. Starting automatic database seed...")

    # Strategy 1: Load pre-computed compressed seed transactions (fastest, git-tracked)
    seed_csv = find_seed_csv_path()
    if seed_csv:
        print(f"Loading pre-computed seed dataset from {seed_csv}...")
        df = pd.read_csv(seed_csv, compression="gzip")
        print(f"Bulk-inserting {len(df)} transactions into database...")
        with engine.begin() as connection:
            df.to_sql('transactions', con=connection, if_exists='append', index=False, method='multi', chunksize=5000)
        print(f"Successfully seeded {len(df)} transactions!")
        seed_investigation_cases()
        return

    # Strategy 2: If ps.csv is available, sample and compute
    paysim_csv = find_paysim_csv_path()
    if paysim_csv:
        seed_database_from_csv(str(paysim_csv), sample_size=50000)
        seed_investigation_cases()
        return

    print("Warning: Neither seed_transactions.csv.gz nor ps.csv found. Database remains empty.")


def reset_demo_state():
    """
    Resets dynamic demonstration state back to clean baseline:
    - Restores investigation cases to initial 9 curated samples and unassigned review cases.
    - Clears orphaned or failed simulation runs.
    Preserves all 50,000 transactions and database tables without dropping data.
    """
    print("Executing demo state reset...")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM investigation_cases;"))
        conn.execute(text("DELETE FROM replay_runs WHERE status IN ('FAILED', 'QUEUED');"))
    seed_investigation_cases()
    print("Demo state successfully reset to baseline.")


if __name__ == "__main__":
    import sys
    if "--reset" in sys.argv:
        reset_demo_state()
    else:
        seed_if_empty()