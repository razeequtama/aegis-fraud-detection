import pytest
from app.services.graph_analysis import FraudGraphAnalyzer

def test_graph_building_and_neighborhood():
    analyzer = FraudGraphAnalyzer()
    
    # Mock data transaksi yang saling terhubung (shared device & session)
    mock_transactions = [
        {"transaction_id": "TX-001", "account_id": "ACC-A", "device_id": "DEV-XYZ", "session_id": "SES-101"},
        {"transaction_id": "TX-002", "account_id": "ACC-B", "device_id": "DEV-XYZ", "session_id": "SES-102"}, # Shared device!
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
    
    print("Graph analysis test passed successfully!")