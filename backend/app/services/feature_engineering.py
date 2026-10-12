import time
from typing import Dict, Any

class FeatureEngineeringService:
    @staticmethod
    def extract_features(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts transactional, velocity, and behavioral features 
        from the incoming transaction payload and historical context.
        """
        amount = data.get("amount", 0.0)
        payment_attempts = data.get("payment_attempts", 1)
        
        # Simple rule-based velocity & derived features for baseline / demonstration
        is_high_velocity = 1 if payment_attempts > 2 else 0
        is_high_amount = 1 if amount > 5000000 else 0  # Example threshold for high value

        features = {
            "amount": amount,
            "payment_attempts": payment_attempts,
            "is_high_velocity": is_high_velocity,
            "is_high_amount": is_high_amount,
        }
        return features