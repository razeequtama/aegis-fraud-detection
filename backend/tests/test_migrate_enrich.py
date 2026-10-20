import pytest
import pandas as pd
from unittest.mock import patch
from sqlalchemy import create_engine, text
from pathlib import Path

from app.db.migrate_enrich import Path as ImportedPath, run_enrichment


def test_code02_path_is_properly_imported():
    """
    CODE-02 Verification:
    Ensures Path is imported from pathlib in migrate_enrich.py.
    """
    assert ImportedPath is Path, "migrate_enrich.py must import Path from pathlib"


def test_code02_migrate_enrich_executes_in_test_db(tmp_path):
    """
    CODE-02 Verification:
    Executes run_enrichment against a mock database with sample PaySim rows,
    confirming that the script runs end-to-end without NameError or crash.
    """
    db_file = tmp_path / "test_migrate.db"
    engine = create_engine(f"sqlite:///{db_file}")

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE transactions (
                transaction_id VARCHAR(64) PRIMARY KEY,
                account_id VARCHAR(64) NOT NULL,
                amount FLOAT NOT NULL,
                type VARCHAR(20) DEFAULT 'TRANSFER',
                oldbalance_org FLOAT DEFAULT 0.0,
                newbalance_orig FLOAT DEFAULT 0.0,
                oldbalance_dest FLOAT DEFAULT 0.0,
                newbalance_dest FLOAT DEFAULT 0.0,
                is_fraud INTEGER DEFAULT 0,
                risk_score FLOAT DEFAULT NULL
            );
        """))
        conn.execute(text("""
            CREATE TABLE investigation_cases (
                case_id VARCHAR(64) PRIMARY KEY,
                transaction_id VARCHAR(64)
            );
        """))
        conn.execute(text("""
            INSERT INTO transactions (transaction_id, account_id, amount)
            VALUES ('TX-100000', 'ACC-001', 500.0), ('TX-100001', 'ACC-002', 1200.0);
        """))

    sample_df = pd.DataFrame([
        {
            "type": "TRANSFER",
            "amount": 500.0,
            "oldbalanceOrg": 500.0,
            "newbalanceOrig": 0.0,
            "oldbalanceDest": 0.0,
            "newbalanceDest": 0.0,
            "isFraud": 1,
        },
        {
            "type": "PAYMENT",
            "amount": 1200.0,
            "oldbalanceOrg": 5000.0,
            "newbalanceOrig": 3800.0,
            "oldbalanceDest": 0.0,
            "newbalanceDest": 0.0,
            "isFraud": 0,
        },
    ])

    with patch("pandas.read_csv", return_value=sample_df):
        # Should execute cleanly without NameError
        run_enrichment(target_engine=engine)

    with engine.connect() as conn:
        count = conn.execute(text("SELECT count(*) FROM transactions")).scalar()
        assert count == 2

    engine.dispose()
