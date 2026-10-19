import pytest
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, MetaData, String, Table, create_engine
from sqlalchemy.orm import Session

from app.api.routes.network import get_transaction_network
from app.services.graph_analysis import FraudGraphAnalyzer

def test_graph_building_and_neighborhood():
    analyzer = FraudGraphAnalyzer()
    
    # Mock data transaksi yang saling terhubung (shared device & session)
    mock_transactions = [
        {"transaction_id": "TX-001", "account_id": "ACC-A", "device_id": "DEV-XYZ", "session_id": "SES-101"},
        {"transaction_id": "TX-002", "account_id": "ACC-B", "device_id": "DEV-XYZ", "session_id": "SES-102", "label": "fraud"}, # Shared device!
    ]
    
    # 1. Bangun graph
    analyzer.build_graph_from_transactions(mock_transactions)
    
    # 2. Uji ekstraksi fitur graph untuk ACC-A (harus mendeteksi shared device)
    features = analyzer.extract_graph_features("ACC-A")
    assert features["shared_devices_count"] > 0.0, "Graph should detect shared devices"
    
    # 3. Uji pengambilan neighborhood graph
    neighborhood = analyzer.get_entity_neighborhood("Account:ACC-A", radius=2)
    assert len(neighborhood["nodes"]) > 0, "Neighborhood graph should return connected nodes"
    assert neighborhood["center_node"] == "Account:ACC-A"
    nodes_by_id = {node["id"]: node for node in neighborhood["nodes"]}
    assert nodes_by_id["Account:ACC-B"]["suspicious"] is True
    assert nodes_by_id["Device:DEV-XYZ"]["shared"] is True

    # 4. Test defensive radius clamping (radius=10 is clamped to 3, radius=0 is clamped to 1)
    clamped_large = analyzer.get_entity_neighborhood("Account:ACC-A", radius=10)
    clamped_small = analyzer.get_entity_neighborhood("Account:ACC-A", radius=0)
    assert len(clamped_large["nodes"]) > 0
    assert len(clamped_small["nodes"]) > 0

    print("Graph analysis test passed successfully!")


@pytest.mark.parametrize(
    ("account_column", "fraud_column", "fraud_type", "fraud_value"),
    [
        ("account_id", "label", Integer, 1),
        ("name_orig", "is_fraud", Boolean, True),
    ],
)
def test_transaction_network_endpoint_builds_neighborhood_from_database(
    account_column, fraud_column, fraud_type, fraud_value
):
    engine = create_engine("sqlite://")
    metadata = MetaData()
    transactions = Table(
        "transactions",
        metadata,
        Column("transaction_id", String, primary_key=True),
        Column(account_column, String, nullable=False),
        Column("device_id", String),
        Column("session_id", String),
        Column("amount", Float),
        Column(fraud_column, fraud_type),
    )
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            transactions.insert(),
            [
                {
                    "transaction_id": "TX-NET-1",
                    account_column: "ACC-NET-1",
                    "device_id": "DEV-SHARED",
                    "session_id": "SES-1",
                    "amount": 10,
                    fraud_column: fraud_value,
                },
                {
                    "transaction_id": "TX-NET-2",
                    account_column: "ACC-NET-2",
                    "device_id": "DEV-SHARED",
                    "session_id": "SES-2",
                    "amount": 20,
                    fraud_column: False if fraud_type is Boolean else 0,
                },
            ],
        )

    with Session(engine) as db:
        network = get_transaction_network("TX-NET-1", db=db)

    nodes = {node["id"]: node for node in network["nodes"]}
    assert network["center_node"] == "Transaction:TX-NET-1"
    assert nodes["Account:ACC-NET-1"]["suspicious"] is True
    assert nodes["Device:DEV-SHARED"]["shared"] is True
    assert any(edge["source"] == "Account:ACC-NET-1" for edge in network["edges"])
    engine.dispose()