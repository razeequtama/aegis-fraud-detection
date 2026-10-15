import os
from pathlib import Path
from dotenv import load_dotenv
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

from app.services.risk_engine import risk_engine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:[REDACTED]@localhost:5433/aegis_db")
engine = create_engine(DATABASE_URL)


def run_enrichment():
    print(f"Connecting to database on port 5433...")
    with engine.begin() as conn:
        print("Ensuring columns exist on transactions table...")
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'TRANSFER';"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS oldbalance_org DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS newbalance_orig DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS oldbalance_dest DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS newbalance_dest DOUBLE PRECISION DEFAULT 0.0;"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_fraud INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS risk_score DOUBLE PRECISION DEFAULT NULL;"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_transactions_risk_score ON transactions (risk_score);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_transactions_type ON transactions (type);"))

        # Sync alembic_version to 001_initial_schema
        conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num));"))
        conn.execute(text("DELETE FROM alembic_version;"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001_initial_schema');"))

    base_dir = Path(__file__).resolve().parents[3]
    csv_path = base_dir / "ml" / "data" / "ps.csv"
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
    with engine.begin() as conn:
        staging_update.to_sql("transactions_staging", con=conn, if_exists="replace", index=False)
        print("Performing bulk update from staging table...")
        conn.execute(text("""
            UPDATE transactions t
            SET 
                type = s.type,
                oldbalance_org = s.oldbalance_org,
                newbalance_orig = s.newbalance_orig,
                oldbalance_dest = s.oldbalance_dest,
                newbalance_dest = s.newbalance_dest,
                is_fraud = s.is_fraud,
                risk_score = s.risk_score
            FROM transactions_staging s
            WHERE t.transaction_id = s.transaction_id;
        """))
        conn.execute(text("DROP TABLE transactions_staging;"))

        # Update manual/preset transactions
        samples = [
            ("TX-SAMPLE-APPROVE", "PAYMENT", 20000.0, 18800.0, 20000.0, 21200.0, 0, 1, 0.01),
            ("TX-SAMPLE-REVIEW", "TRANSFER", 100000.0, 10000.0, 20000.0, 105000.0, 0, 2, 0.4978),
            ("TX-SAMPLE-DECLINE", "CASH_OUT", 2000000.0, 0.0, 250000.0, 2250000.0, 1, 3, 0.99),
            ("TX-99901", "TRANSFER", 100000.0, 10000.0, 20000.0, 105000.0, 0, 2, 0.4978),
        ]
        for tid, ttype, ob_org, nb_orig, ob_dest, nb_dest, is_f, p_att, r_score in samples:
            conn.execute(text("""
                UPDATE transactions
                SET type = :ttype,
                    oldbalance_org = :ob_org,
                    newbalance_orig = :nb_orig,
                    oldbalance_dest = :ob_dest,
                    newbalance_dest = :nb_dest,
                    is_fraud = :is_f,
                    payment_attempts = :p_att,
                    risk_score = :r_score
                WHERE transaction_id = :tid;
            """), {
                "tid": tid, "ttype": ttype, "ob_org": ob_org, "nb_orig": nb_orig,
                "ob_dest": ob_dest, "nb_dest": nb_dest, "is_f": is_f, "p_att": p_att, "r_score": r_score
            })

    print("Data enrichment complete! Verifying database counts...")
    with engine.connect() as conn:
        total = conn.execute(text("SELECT count(*) FROM transactions")).scalar()
        low = conn.execute(text("SELECT count(*) FROM transactions WHERE risk_score < 0.40")).scalar()
        med = conn.execute(text("SELECT count(*) FROM transactions WHERE risk_score >= 0.40 AND risk_score <= 0.74")).scalar()
        high = conn.execute(text("SELECT count(*) FROM transactions WHERE risk_score > 0.74")).scalar()
        print(f"Total: {total} | Low (<0.40): {low} | Medium (0.40-0.74): {med} | High (>0.74): {high}")


if __name__ == "__main__":
    run_enrichment()

