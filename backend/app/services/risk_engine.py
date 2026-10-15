import os
from pathlib import Path
import joblib
import numpy as np

from app.services.graph_analysis import graph_analyzer
from app.core.redis import check_transaction_velocity


class RiskEngine:
    MODEL_VERSION = "aegis-rf-0.1.0"
    REVIEW_THRESHOLD = 0.40
    DECLINE_THRESHOLD = 0.75

    def __init__(self):
        artifacts_dir = Path(
            os.getenv(
                "ML_ARTIFACTS_DIR",
                Path(__file__).resolve().parents[3] / "ml" / "artifacts",
            )
        )
        self.model_path = artifacts_dir / "fraud_rf_model.joblib"
        self.scaler_path = artifacts_dir / "scaler.joblib"

        self.model = None
        self.scaler = None
        self.model_version = self.MODEL_VERSION
        self.load_artifacts()

    def load_artifacts(self):
        """Load trained Random Forest model and scaler safely."""
        try:
            if self.model_path.is_file() and self.scaler_path.is_file():
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.model_version = getattr(self.model, "model_version", self.MODEL_VERSION)
                print("RiskEngine: Model and scaler loaded successfully.")
            else:
                print("RiskEngine Warning: Model artifacts not found. Engine will run in fallback mode.")
        except Exception as exc:
            print(f"RiskEngine Error loading artifacts: {exc}")

    def _normalize_transaction_type(self, tx_type):
        return str(tx_type or "TRANSFER").upper()

    def _get_type_flags(self, tx_type):
        normalized = self._normalize_transaction_type(tx_type)
        return {
            "CASH_OUT": 1 if normalized == "CASH_OUT" else 0,
            "CASH_IN": 1 if normalized == "CASH_IN" else 0,
            "DEBIT": 1 if normalized == "DEBIT" else 0,
            "PAYMENT": 1 if normalized == "PAYMENT" else 0,
            "TRANSFER": 1 if normalized == "TRANSFER" else 0,
        }

    def _build_feature_vector(self, tx_data: dict) -> np.ndarray:
        amount = float(tx_data.get("amount", 0.0) or 0.0)
        oldbalance_org = float(tx_data.get("oldbalanceOrg", tx_data.get("oldbalance_org", 0.0)) or 0.0)
        newbalance_orig = float(tx_data.get("newbalanceOrig", tx_data.get("newbalance_orig", 0.0)) or 0.0)
        oldbalance_dest = float(tx_data.get("oldbalanceDest", tx_data.get("oldbalance_dest", 0.0)) or 0.0)
        newbalance_dest = float(tx_data.get("newbalanceDest", tx_data.get("newbalance_dest", 0.0)) or 0.0)

        error_balance_org = newbalance_orig + amount - oldbalance_org
        error_balance_dest = oldbalance_dest + amount - newbalance_dest

        type_flags = self._get_type_flags(tx_data.get("type", "TRANSFER"))

        feature_vector = [
            amount,
            oldbalance_org,
            newbalance_orig,
            oldbalance_dest,
            newbalance_dest,
            error_balance_org,
            error_balance_dest,
            type_flags["CASH_OUT"],
            type_flags["DEBIT"],
            type_flags["PAYMENT"],
            type_flags["TRANSFER"],
        ]
        return np.array([feature_vector], dtype=float)

    def predict_proba_batch(self, feature_matrix: np.ndarray) -> np.ndarray:
        """Run vectorized inference on a 2D matrix of features, returning fraud probabilities."""
        if self.model is not None and self.scaler is not None:
            scaled = self.scaler.transform(feature_matrix)
            probs = self.model.predict_proba(scaled)
            return probs[:, 1]
        return np.array([0.5] * len(feature_matrix), dtype=float)

    def _apply_decision_policy(
        self, risk_score: float, error_balance_org: float, payment_attempts: int = 1
    ) -> tuple[str, list[dict]]:
        signals = []
        if risk_score >= self.DECLINE_THRESHOLD:
            decision = "decline"
            signals.append({
                "name": "high_fraud_probability",
                "description": "Model predicts a high probability of fraudulent activity.",
            })
        elif risk_score >= self.REVIEW_THRESHOLD:
            decision = "review"
            signals.append({
                "name": "moderate_risk_velocity",
                "description": "Transaction is above the review threshold and requires analyst review.",
            })
        else:
            decision = "approve"

        if error_balance_org != 0:
            signals.append({
                "name": "balance_discrepancy",
                "description": "Source account balance mismatch indicates an anomalous transaction pattern.",
            })

        if payment_attempts > 2:
            signals.append({
                "name": "high_payment_attempts",
                "description": f"Multiple payment attempts detected ({payment_attempts} attempts).",
            })

        return decision, signals

    def evaluate_transaction(
        self,
        tx_data: dict,
        historical_transactions: list | None = None,
        check_velocity: bool = True,
    ) -> dict:
        """Process an incoming transaction using the trained model and decision policy."""
        if historical_transactions is None:
            historical_transactions = []

        account_id = tx_data.get("account_id")
        graph_features = {}
        if account_id:
            if historical_transactions:
                graph_analyzer.build_graph_from_transactions(historical_transactions)
            graph_features = graph_analyzer.extract_graph_features(account_id)

        amount = float(tx_data.get("amount", 0.0) or 0.0)
        oldbalance_org = float(tx_data.get("oldbalanceOrg", tx_data.get("oldbalance_org", 0.0)) or 0.0)
        newbalance_orig = float(tx_data.get("newbalanceOrig", tx_data.get("newbalance_orig", 0.0)) or 0.0)
        error_balance_org = newbalance_orig + amount - oldbalance_org
        payment_attempts = int(tx_data.get("payment_attempts", 1) or 1)

        features = self._build_feature_vector(tx_data)
        risk_score = 0.0

        if self.model and self.scaler:
            try:
                scaled_features = self.scaler.transform(features)
                risk_score = float(self.model.predict_proba(scaled_features)[0][1])
            except Exception as exc:
                print(f"Inference error: {exc}")
                risk_score = 0.5
        else:
            risk_score = 0.85 if amount > 200000 and error_balance_org != 0 else 0.12

        # Check transaction velocity in Redis (sliding window of 60s) if enabled
        velocity = 1
        if check_velocity and account_id:
            velocity = check_transaction_velocity(str(account_id), window_seconds=60)
            if velocity > 3:
                # Add penalty to risk_score for velocity burst
                risk_score = min(1.0, risk_score + 0.35)

        decision, signals = self._apply_decision_policy(
            risk_score, error_balance_org, payment_attempts=payment_attempts
        )

        if velocity > 3:
            signals.append({
                "name": "high_velocity_burst",
                "description": f"Unusual velocity burst detected: account initiated {velocity} transactions within 60 seconds.",
            })

        shared_devices = float(graph_features.get("shared_devices_count", 0.0) or 0.0)
        node_degree = float(graph_features.get("node_degree", 0.0) or 0.0)

        if shared_devices > 0:
            signals.append({
                "name": "shared_device_detected",
                "description": f"Account shares devices with other entities (shared count: {int(shared_devices)}).",
            })

        result = {
            "risk_score": round(float(risk_score), 4),
            "decision": decision,
            "model_version": self.model_version,
            "signals": signals,
            "velocity": velocity,
            "graph_metrics": {
                "shared_devices_count": shared_devices,
                "node_degree": node_degree,
            },
        }
        return result

    def evaluate_risk(
        self,
        tx_data: dict,
        historical_transactions: list | None = None,
        check_velocity: bool = True,
    ) -> dict:
        return self.evaluate_transaction(
            tx_data,
            historical_transactions=historical_transactions,
            check_velocity=check_velocity,
        )

    def enrich_with_graph_features(self, account_id: str, transaction_history: list) -> dict:
        graph_analyzer.build_graph_from_transactions(transaction_history)
        return graph_analyzer.extract_graph_features(account_id)


risk_engine = RiskEngine()