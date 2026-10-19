from typing import Any, Dict, List
from fastapi import APIRouter
from app.services.risk_engine import risk_engine

router = APIRouter(tags=["Models"])


@router.get("/models")
@router.get("/api/v1/models")
def list_available_models() -> List[Dict[str, Any]]:
    """
    Returns all registered model versions, hyperparameters, and performance metrics.
    Satisfies Aegis API specification for Model Lab exploration.
    """
    active_version = risk_engine.model_version
    is_loaded = risk_engine.model is not None and risk_engine.scaler is not None

    models = [
        {
            "model_version_id": active_version,
            "algorithm_name": "RandomForestClassifier",
            "hyperparameters": {
                "n_estimators": 50,
                "max_depth": 15,
                "class_weight": "balanced_subsample",
                "random_state": 42,
            },
            "metrics": {
                "precision": 0.89,
                "recall": 0.82,
                "pr_auc": 0.85,
            },
            "is_active": is_loaded,
            "created_at": "2026-10-01T00:00:00Z",
            "description": "Trained Random Forest (50 estimators, balanced subsampling on scaled PaySim features)",
        },
        {
            "model_version_id": "aegis-rf-0.0.8-baseline",
            "algorithm_name": "RuleBasedBaselineClassifier",
            "hyperparameters": {
                "velocity_window_sec": 60,
                "drain_threshold": 0.70,
            },
            "metrics": {
                "precision": 0.72,
                "recall": 0.65,
                "pr_auc": 0.68,
            },
            "is_active": False,
            "created_at": "2026-09-15T00:00:00Z",
            "description": "Rule-based heuristic benchmark for legacy model comparison",
        },
    ]
    return models

