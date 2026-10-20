import os
from pathlib import Path
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.services.risk_engine import risk_engine


def get_engine():
    raw_database_url = os.environ.get("DATABASE_URL")
    if not raw_database_url or not raw_database_url.strip():
        raise RuntimeError(
            "DATABASE_URL environment variable is missing or empty. "
            "Please ensure DATABASE_URL is set in the process environment."
        )

    database_url = raw_database_url.strip()

    database_host = os.environ.get("DATABASE_HOST")
    if database_host and database_host.strip():
        url_obj = make_url(database_url)
        if url_obj.host != database_host.strip():
            database_url = str(url_obj.set(host=database_host.strip()))

    return create_engine(database_url)


# Default engine when DATABASE_URL is present at import time
engine = None
if os.environ.get("DATABASE_URL"):
    try:
        engine = get_engine()
    except Exception:
        pass


def run_enrichment(target_engine=None):
    active_engine = target_engine or engine or get_engine()
    print("Connecting to database...")
    with active_engine.begin() as conn:
        print("Ensuring columns exist on transactions table...")
        for col_stmt in [
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'TRANSFER';",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS oldbalance_org DOUBLE PRECISION DEFAULT 0.0;",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS newbalance_orig DOUBLE PRECISION DEFAULT 0.0;",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS oldbalance_dest DOUBLE PRECISION DEFAULT 0.0;",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS newbalance_dest DOUBLE PRECISION DEFAULT 0.0;",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_fraud INTEGER DEFAULT 0;",
            "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS risk_score DOUBLE PRECISION DEFAULT NULL;",
            "CREATE INDEX IF NOT EXISTS ix_transactions_risk_score ON transactions (risk_score);",
            "CREATE INDEX IF NOT EXISTS ix_transactions_type ON transactions (type);",
            "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num));",
            "DELETE FROM alembic_version;",
            "INSERT INTO alembic_version (version_num) VALUES ('001_initial_schema');",
        ]:
            try:
                conn.execute(text(col_stmt))
            except Exception as e:
                # Catch dialect-specific syntax differences (e.g. SQLite vs PostgreSQL)
                pass

    candidates = [
        Path(__file__).resolve().parents[3] / "ml" / "data" / "ps.csv",
        Path(__file__).resolve().parents[2] / "ml" / "data" / "ps.csv",
        Path("/ml/data/ps.csv"),
    ]
    csv_path = next((p for p in candidates if p.is_file()), candidates[0])
    print(f"Loading PaySim dataset from {csv_path}...")
    df = pd.read_csv(csv_path)

    fraud_df = df[df["isFraud"] == 1]
    legit_df = df[df["isFraud"] == 0].sample(n=min(50000 - len(fraud_df), len(df[df["isFraud"] == 0])), random_state=42)
    sampled_df = pd.concat([fraud_df, legit_df]).sample(frac=1, random_state=42).reset_index(drop=True)
    print(f"Prepared {len(sampled_df)} PaySim sample records.")

    staging_rows = []
    for idx, row in sampled_df.iterrows():
        tx_id = f"TX-{100000 + idx}"
        staging_rows.append({
            "transaction_id": tx_id,
            "type": str(row.get("type", "TRANSFER")).upper(),
            "oldbalance_org": float(row.get("oldbalanceOrg", 0.0)),
            "newbalance_orig": float(row.get("newbalanceOrig", 0.0)),
            "oldbalance_dest": float(row.get("oldbalanceDest", 0.0)),
            "newbalance_dest": float(row.get("newbalanceDest", 0.0)),
            "is_fraud": int(row["isFraud"]),
            "amount": float(row["amount"]),
        })

    staging_df = pd.DataFrame(staging_rows)
    print("Computing real ML + pattern continuous risk scores for transactions...")
    feature_matrix = []
    for _, r in staging_df.iterrows():
        fv = risk_engine._build_feature_vector(r)[0]
        feature_matrix.append(fv)

    matrix = np.array(feature_matrix, dtype=float)
    scores = risk_engine.predict_proba_batch(matrix)
    staging_df["risk_score"] = scores

    staging_update = staging_df[[
        "transaction_id", "type", "oldbalance_org", "newbalance_orig",
        "oldbalance_dest", "newbalance_dest", "is_fraud", "risk_score"
    ]]

    print("Uploading staging data to PostgreSQL...")
    with active_engine.begin() as conn:
        staging_update.to_sql("transactions_staging", con=conn, if_exists="replace", index=False)
        print("Performing bulk update from staging table...")
        conn.execute(text("""
            UPDATE transactions
            SET 
                type = transactions_staging.type,
                oldbalance_org = transactions_staging.oldbalance_org,
                newbalance_orig = transactions_staging.newbalance_orig,
                oldbalance_dest = transactions_staging.oldbalance_dest,
                newbalance_dest = transactions_staging.newbalance_dest,
                is_fraud = transactions_staging.is_fraud,
                risk_score = transactions_staging.risk_score
            FROM transactions_staging
            WHERE transactions.transaction_id = transactions_staging.transaction_id;
        """))
        conn.execute(text("DROP TABLE transactions_staging;"))

        # Clean up any legacy mock samples if present
        try:
            conn.execute(text("DELETE FROM investigation_cases WHERE transaction_id LIKE '%SAMPLE%' OR transaction_id = 'TX-99901';"))
        except Exception:
            pass
        try:
            conn.execute(text("DELETE FROM transactions WHERE transaction_id LIKE '%SAMPLE%' OR transaction_id = 'TX-99901';"))
        except Exception:
            pass

    print("Data enrichment complete! Verifying database counts...")
    with active_engine.connect() as conn:
        total = conn.execute(text("SELECT count(*) FROM transactions")).scalar()
        low = conn.execute(text("SELECT count(*) FROM transactions WHERE risk_score < 0.40")).scalar()
        med = conn.execute(text("SELECT count(*) FROM transactions WHERE risk_score >= 0.40 AND risk_score <= 0.74")).scalar()
        high = conn.execute(text("SELECT count(*) FROM transactions WHERE risk_score > 0.74")).scalar()
        print(f"Total: {total} | Low (<0.40): {low} | Medium (0.40-0.74): {med} | High (>0.74): {high}")


if __name__ == "__main__":
    run_enrichment()

