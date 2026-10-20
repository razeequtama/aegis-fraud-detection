import pytest
from sqlalchemy import create_engine
from app.db.session import Base
from app.models.models import Transaction
from app.services.graph_analysis import FraudGraphAnalyzer, graph_analyzer
from app.services.risk_engine import risk_engine


def test_perf02_transaction_indexes_defined_in_model():
    """
    PERF-02 Verification:
    Ensures ix_transactions_timestamp_desc, ix_transactions_type,
    and ix_transactions_is_fraud are defined on Transaction table metadata.
    """
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    
    index_names = {idx.name for idx in Transaction.__table__.indexes}
    assert "ix_transactions_timestamp_desc" in index_names, "Missing timestamp DESC index"
    assert "ix_transactions_type" in index_names, "Missing type index"
    assert "ix_transactions_is_fraud" in index_names, "Missing is_fraud index"
    engine.dispose()


def test_perf02_alembic_migration_002_metadata():
    """
    PERF-02 Verification:
    Ensures Alembic migration 002 exists, links to 001_initial_schema,
    and defines valid upgrade/downgrade routines.
    """
    import importlib.util
    from pathlib import Path

    migration_path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "002_add_transaction_performance_indexes.py"
    assert migration_path.is_file(), f"Migration file missing at {migration_path}"

    spec = importlib.util.spec_from_file_location("migration_002", migration_path)
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)

    assert mig.revision == "002_add_tx_perf_indexes"
    assert len(mig.revision) <= 32
    assert mig.down_revision == "001_initial_schema"
    assert callable(mig.upgrade)
    assert callable(mig.downgrade)


def test_func01_graph_analyzer_populates_and_extracts_relational_features():
    """
    FUNC-01 Verification:
    Ensures FraudGraphAnalyzer populates transaction relationships and returns
    nonzero shared_devices_count for multi-account shared device nodes.
    """
    analyzer = FraudGraphAnalyzer()
    loaded_count = analyzer.populate_from_db()
    assert loaded_count > 0, "Graph analyzer should load transaction records"
    assert len(analyzer.graph.nodes) > 0, "Graph analyzer should contain entity nodes"

    # Assess syndicate account C376938867 associated with TX-100463
    features = analyzer.extract_graph_features("C376938867")
    assert features["shared_devices_count"] > 0, "shared_devices_count must be > 0"
    assert features["shared_devices_count"] == 51.0, "DEV-SIM-402 is shared with 51 peer accounts"
    assert features["node_degree"] >= 1.0


def test_func01_risk_evaluation_tx_100463_returns_shared_device_signals():
    """
    FUNC-01 Verification:
    Assesses transaction TX-100463 through risk_engine and verifies that
    shared_devices_count is > 0 and signals include 'shared_device_detected'.
    """
    tx_payload = {
        "transaction_id": "TX-100463",
        "account_id": "C376938867",
        "type": "TRANSFER",
        "amount": 2299330.46,
        "oldbalanceOrg": 2299330.46,
        "newbalanceOrig": 0.0,
        "oldbalanceDest": 0.0,
        "newbalanceDest": 0.0,
        "device_id": "DEV-SIM-402",
        "session_id": "SES-SIM-463",
        "payment_attempts": 1,
    }

    result = risk_engine.evaluate_transaction(tx_payload)

    # 1. Verification of graph metrics
    graph_metrics = result.get("graph_metrics", {})
    assert graph_metrics.get("shared_devices_count", 0.0) > 0, (
        f"shared_devices_count for TX-100463 must be > 0, got {graph_metrics.get('shared_devices_count')}"
    )
    assert graph_metrics.get("shared_devices_count") == 51.0
    assert graph_metrics.get("node_degree", 0.0) > 0

    # 2. Verification of relational pattern signals
    signal_names = [s["name"] for s in result.get("signals", [])]
    assert "shared_device_detected" in signal_names, (
        f"Expected 'shared_device_detected' in signals, got {signal_names}"
    )

    # 3. Overall risk outcome
    assert result["risk_score"] >= 0.90
    assert result["decision"] == "decline"

