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

    def populate_from_db(self, db_session=None, limit: int = 50000, force: bool = False) -> int:
        """
        Populates graph network using transaction records from the database or seed data.
        """
        if not force and self.graph.number_of_nodes() > 0:
            return self.graph.number_of_nodes()

        records: List[Dict[str, Any]] = []

        # 1. Try querying via provided database session or global engine
        try:
            from sqlalchemy import text
            from app.db.session import engine

            query_sql = text(
                "SELECT transaction_id, account_id, device_id, session_id, is_fraud "
                "FROM transactions LIMIT :limit"
            )

            if db_session is not None:
                rows = db_session.execute(query_sql, {"limit": limit}).mappings().all()
                records = [dict(r) for r in rows]
            elif engine is not None:
                with engine.connect() as conn:
                    rows = conn.execute(query_sql, {"limit": limit}).mappings().all()
                    records = [dict(r) for r in rows]
        except Exception:
            pass

        # 2. If database is not populated yet or offline, fallback to seed CSV
        if not records:
            try:
                import gzip
                import csv
                from app.db.seed import find_seed_csv_path

                seed_path = find_seed_csv_path()
                if seed_path and seed_path.is_file():
                    with gzip.open(seed_path, "rt", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        records = [
                            {
                                "transaction_id": row.get("transaction_id"),
                                "account_id": row.get("account_id"),
                                "device_id": row.get("device_id"),
                                "session_id": row.get("session_id"),
                                "is_fraud": row.get("is_fraud", 0),
                            }
                            for idx, row in enumerate(reader)
                            if idx < limit
                        ]
            except Exception:
                pass

        if records:
            self.build_graph_from_transactions(records)
            return len(records)
        return 0

    def extract_graph_features(
        self,
        account_id: str,
        device_id: str = None,
        db_session = None,
    ) -> Dict[str, float]:
        """
        Extracts structural graph features for risk scoring enhancement.
        """
        # Ensure graph is populated on first extraction if empty
        if len(self.graph.nodes) == 0:
            self.populate_from_db(db_session=db_session)

        node_key = f"Account:{account_id}"
        dev_key = f"Device:{device_id}" if device_id else None

        # If entity is not in memory graph, check direct SQL if session is available
        if node_key not in self.graph and dev_key not in self.graph and db_session is not None:
            try:
                from sqlalchemy import text
                query = text("""
                    SELECT COUNT(DISTINCT t2.account_id)
                    FROM transactions t1
                    JOIN transactions t2 ON t1.device_id = t2.device_id
                    WHERE (t1.account_id = :acc OR (:dev IS NOT NULL AND t1.device_id = :dev))
                      AND t2.account_id != :acc
                """)
                res = db_session.execute(query, {"acc": str(account_id), "dev": device_id}).scalar()
                if res is not None and res > 0:
                    return {
                        "shared_devices_count": float(res),
                        "node_degree": 1.0,
                    }
            except Exception:
                pass

        if node_key not in self.graph and dev_key not in self.graph:
            return {
                "shared_devices_count": 0.0,
                "node_degree": 0.0,
            }

        shared_devices_count = 0.0
        devices: list[str] = []

        if node_key in self.graph:
            neighbors = list(self.graph.neighbors(node_key))
            devices.extend([n for n in neighbors if n.startswith("Device:")])

        if dev_key and dev_key in self.graph and dev_key not in devices:
            devices.append(dev_key)

        for dev in devices:
            connected_accounts = [n for n in self.graph.neighbors(dev) if n.startswith("Account:")]
            other_accounts = [acc for acc in connected_accounts if acc != node_key]
            if other_accounts:
                shared_devices_count += len(other_accounts)

        node_degree = float(self.graph.degree(node_key)) if node_key in self.graph else (1.0 if dev_key in self.graph else 0.0)

        return {
            "shared_devices_count": float(shared_devices_count),
            "node_degree": node_degree,
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
    device_id = enriched.get("device_id")
    
    if account_id:
        features = graph_analyzer.extract_graph_features(
            str(account_id),
            device_id=str(device_id) if device_id else None,
            db_session=db_session,
        )
        enriched.update(features)
    else:
        enriched["shared_devices_count"] = 0.0
        enriched["node_degree"] = 0.0
        
    return enriched