import time
from typing import Dict, Any, List
from app.services.feature_engineering import FeatureEngineeringService
from app.schemas.risk import SignalItem

class RiskEngineService:
    def __init__(self, model_version: str = "aegis-0.1.0"):
        self.model_version = model_version

    def evaluate_risk(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        start_time = time.time()
        
        # 1. Feature Engineering
        features = FeatureEngineeringService.extract_features(payload)
        
        # 2. Mock / Baseline Risk Scoring Logic (to be replaced by trained scikit-learn model artifacts)
        risk_score = 0.1
        signals: List[SignalItem] = []

        if features["is_high_velocity"]:
            risk_score += 0.4
            signals.append(SignalItem(
                name="unusual_transaction_velocity",
                description="Activity exceeds the configured velocity threshold based on payment attempts."
            ))

        if features["is_high_amount"]:
            risk_score += 0.3
            signals.append(SignalItem(
                name="high_transaction_amount",
                description="Transaction amount is significantly higher than typical baseline."
            ))

        # Cap risk score between 0.0 and 1.0
        risk_score = min(max(risk_score, 0.0), 1.0)

        # 3. Decision Policy Layer (Threshold mapping)
        # Thresholds: < 0.4 -> approve, 0.4 to 0.75 -> review, > 0.75 -> decline
        if risk_score >= 0.75:
            decision = "decline"
        elif risk_score >= 0.4:
            decision = "review"
        else:
            decision = "approve"

        latency_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "transaction_id": payload.get("transaction_id"),
            "risk_score": round(risk_score, 2),
            "decision": decision,
            "model_version": self.model_version,
            "signals": [s.model_dump() for s in signals],
            "latency_ms": latency_ms
        }