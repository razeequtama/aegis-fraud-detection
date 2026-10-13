import os
import joblib
import numpy as np
import pandas as pd
from app.services.graph_analysis import graph_analyzer

class RiskEngine:
    def __init__(self):
        # Path to ML artifacts saved during training stage
        self.model_path = "ml/artifacts/fraud_rf_model.joblib"
        self.scaler_path = "ml/artifacts/scaler.joblib"
        
        self.model = None
        self.scaler = None
        self.load_artifacts()

    def load_artifacts(self):
        """Load trained Random Forest model and scaler safely."""
        try:
            if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                print("RiskEngine: Model and scaler loaded successfully.")
            else:
                print("RiskEngine Warning: Model artifacts not found. Engine will run in mock/fallback mode.")
        except Exception as e:
            print(f"RiskEngine Error loading artifacts: {e}")

    def evaluate_transaction(self, tx_data: dict) -> dict:
        """
        Process incoming transaction features, run ML model inference,
        and apply decision policy thresholds.
        """
        # Extract raw features matching training columns
        amount = tx_data.get("amount", 0.0)
        oldbalanceOrg = tx_data.get("oldbalanceOrg", 0.0)
        newbalanceOrig = tx_data.get("newbalanceOrig", 0.0)
        oldbalanceDest = tx_data.get("oldbalanceDest", 0.0)
        newbalanceDest = tx_data.get("newbalanceDest", 0.0)
        
        # Calculate engineered error features (same as training pipeline)
        errorBalanceOrg = newbalanceOrig + amount - oldbalanceOrg
        errorBalanceDest = oldbalanceDest + amount - newbalanceDest
        
        # Transaction type dummy flags (default to 0 if not provided)
        tx_type = tx_data.get("type", "TRANSFER")
        is_cash_out = 1 if tx_type == "CASH_OUT" else 0
        is_debit = 1 if tx_type == "DEBIT" else 0
        is_payment = 1 if tx_type == "PAYMENT" else 0
        is_transfer = 1 if tx_type == "TRANSFER" else 0

        # Construct feature array matching the 11 training features order
        features = np.array([[
            amount, oldbalanceOrg, newbalanceOrig, 
            oldbalanceDest, newbalanceDest, 
            errorBalanceOrg, errorBalanceDest,
            is_cash_out, is_debit, is_payment, is_transfer
        ]])

        risk_score = 0.0
        signals = []

        # Run inference if model is loaded
        if self.model and self.scaler:
            try:
                scaled_features = self.scaler.transform(features)
                # Predict probability of class 1 (Fraud)
                risk_score = float(self.model.predict_proba(scaled_features)[0][1])
                print(f"DEBUG - Raw Risk Score calculated by model: {risk_score}") # <-- Tambahkan ini
            except Exception as e:
                print(f"Inference error: {e}")
                risk_score = 0.5 # Fallback score
        else:
            # Fallback heuristic rule if model artifact is missing
            if amount > 200000 and errorBalanceOrg != 0:
                risk_score = 0.85
            else:
                risk_score = 0.12

        # Decision Policy Layer (Thresholds)
        # < 0.4: approve, 0.4 - 0.75: review, > 0.75: decline
        if risk_score >= 0.75:
            decision = "decline"
            signals.append({"name": "high_fraud_probability", "description": "Model predicts high risk of fraudulent pattern."})
        elif risk_score >= 0.40:
            decision = "review"
            signals.append({"name": "moderate_risk_velocity", "description": "Transaction requires analyst review due to suspicious balance shift."})
        else:
            decision = "approve"

        if errorBalanceOrg != 0:
            signals.append({"name": "balance_discrepancy", "description": "Discrepancy detected in source account balance calculation."})

        return {
            "risk_score": round(risk_score, 4),
            "decision": decision,
            "model_version": "aegis-rf-v1.0",
            "signals": signals
        }

    def enrich_with_graph_features(account_id: str, transaction_history: list) -> dict:
        # Build or update graph dynamically with recent transactions
        graph_analyzer.build_graph_from_transactions(transaction_history)
        
        # Extract graph features
        graph_feats = graph_analyzer.extract_graph_features(account_id)
        return graph_feats

# Singleton instance
risk_engine = RiskEngine()