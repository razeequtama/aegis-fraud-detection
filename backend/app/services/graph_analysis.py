import networkx as nx
from typing import Dict, List, Any

class FraudGraphAnalyzer:
    def __init__(self):
        # Initialize an undirected graph for entity relationship mapping
        self.graph = nx.Graph()

    def build_graph_from_transactions(self, transactions: List[Dict[str, Any]]) -> None:
        """
        Builds a graph network connecting accounts, devices, sessions, and transactions.
        """
        self.graph.clear()
        for tx in transactions:
            tx_id = tx.get("transaction_id")
            account_id = tx.get("account_id")
            device_id = tx.get("device_id")
            session_id = tx.get("session_id")
            suspicious = self._is_suspicious(
                tx.get("is_fraud", tx.get("label", tx.get("is_flagged_fraud")))
            )

            # Add nodes and edges representing relationships
            if account_id and device_id:
                account_node = f"Account:{account_id}"
                device_node = f"Device:{device_id}"
                self.graph.add_node(account_node, type="account", suspicious=False)
                self.graph.nodes[account_node]["suspicious"] = (
                    self.graph.nodes[account_node]["suspicious"] or suspicious
                )
                self.graph.add_node(device_node, type="device")
                self.graph.add_edge(account_node, device_node, relation="uses_device")
            if account_id and session_id:
                account_node = f"Account:{account_id}"
                self.graph.add_node(account_node, type="account", suspicious=False)
                self.graph.nodes[account_node]["suspicious"] = (
                    self.graph.nodes[account_node]["suspicious"] or suspicious
                )
                self.graph.add_node(f"Session:{session_id}", type="session")
                self.graph.add_edge(account_node, f"Session:{session_id}", relation="has_session")
            if tx_id and account_id:
                account_node = f"Account:{account_id}"
                self.graph.add_node(account_node, type="account", suspicious=False)
                self.graph.nodes[account_node]["suspicious"] = (
                    self.graph.nodes[account_node]["suspicious"] or suspicious
                )
                transaction_node = f"Transaction:{tx_id}"
                self.graph.add_node(transaction_node, type="transaction")
                self.graph.add_edge(transaction_node, account_node, relation="performed_by")

    @staticmethod
    def _is_suspicious(value: Any) -> bool:
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

    def get_entity_neighborhood(self, entity_id: str, radius: int = 2) -> Dict[str, Any]:
        """
        Retrieves the ego network neighborhood around a specific entity up to a given radius.
        Useful for frontend visualization (Cytoscape.js).
        """
        if entity_id not in self.graph:
            return {"nodes": [], "edges": []}

        # Defensive bounds clamping (1-3) to guard against unbounded traversal
        resolved_radius = (
            radius if isinstance(radius, int)
            else getattr(radius, "default", 2)
            if hasattr(radius, "default") and isinstance(getattr(radius, "default"), int)
            else 2
        )
        safe_radius = min(max(resolved_radius, 1), 3)

        subgraph = nx.ego_graph(self.graph, entity_id, radius=safe_radius)
        
        nodes = []
        for node, attributes in subgraph.nodes(data=True):
            node_type = attributes.get("type", node.split(":", 1)[0].lower())
            shared = node_type == "device" and sum(
                1
                for neighbor in self.graph.neighbors(node)
                if self.graph.nodes[neighbor].get("type") == "account"
            ) > 1
            nodes.append(
                {
                    "id": node,
                    "label": node,
                    "type": node_type,
                    "suspicious": bool(attributes.get("suspicious", False)),
                    "shared": shared,
                }
            )
        edges = [
            {"source": u, "target": v, "relation": data.get("relation", "connected")}
            for u, v, data in subgraph.edges(data=True)
        ]

        return {
            "center_node": entity_id,
            "nodes": nodes,
            "edges": edges,
            "metrics": {
                "degree": self.graph.degree(entity_id),
                "neighborhood_size": len(subgraph.nodes())
            }
        }

    def extract_graph_features(self, account_id: str) -> Dict[str, float]:
        """
        Extracts structural graph features for risk scoring enhancement.
        """
        node_key = f"Account:{account_id}"
        if node_key not in self.graph:
            return {
                "shared_devices_count": 0.0,
                "node_degree": 0.0
            }

        # Count how many devices are shared with this account
        neighbors = list(self.graph.neighbors(node_key))
        devices = [n for n in neighbors if n.startswith("Device:")]
        
        shared_devices_count = 0.0
        for dev in devices:
            # Count total accounts connected to this device
            connected_accounts = [n for n in self.graph.neighbors(dev) if n.startswith("Account:")]
            if len(connected_accounts) > 1:
                shared_devices_count += len(connected_accounts) - 1

        return {
            "shared_devices_count": float(shared_devices_count),
            "node_degree": float(self.graph.degree(node_key))
        }

# Global instance for dependency injection or service use
graph_analyzer = FraudGraphAnalyzer()

def enrich_with_graph_features(transaction_data: dict, db_session=None) -> dict:
    """
    Helper function used by risk_engine to enrich transaction data 
    with relational features extracted from the graph analyzer.
    """
    enriched = transaction_data.copy()
    account_id = enriched.get("account_id")
    
    if account_id:
        features = graph_analyzer.extract_graph_features(str(account_id))
        enriched.update(features)
    else:
        enriched["shared_devices_count"] = 0.0
        enriched["node_degree"] = 0.0
        
    return enriched