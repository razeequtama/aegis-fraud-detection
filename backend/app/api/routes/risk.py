import logging
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.risk import RiskAssessmentRequest, RiskAssessmentResponse
from app.services.observability import record_inference_latency
from app.services.risk_engine import risk_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Risk Assessment"])


@router.get("/risk-assessments/presets")
def get_risk_assessment_presets(db: Session = Depends(get_db)):
    """
    Returns real transaction payloads queried from the database representing
    different risk tiers (Low Risk Approve, Medium Risk Review, High Risk Decline).
    """
    default_presets = [
        {
            "title": "Low risk payment",
            "category": "APPROVE",
            "payload": {
                "transaction_id": "TX-100001",
                "account_id": "C1551703422",
                "type": "PAYMENT",
                "amount": 3123.24,
                "oldbalanceOrg": 50036.0,
                "newbalanceOrig": 46912.76,
                "oldbalanceDest": 0.0,
                "newbalanceDest": 0.0,
                "payment_attempts": 1,
                "device_id": "DEV-SIM-946",
                "session_id": "SES-SIM-1",
            },
        },
        {
            "title": "Medium risk cash-out",
            "category": "REVIEW",
            "payload": {
                "transaction_id": "TX-100017",
                "account_id": "C640492983",
                "type": "CASH_OUT",
                "amount": 36420.6,
                "oldbalanceOrg": 11650.0,
                "newbalanceOrig": 0.0,
                "oldbalanceDest": 1897757.8,
                "newbalanceDest": 1934178.41,
                "payment_attempts": 1,
                "device_id": "DEV-SIM-367",
                "session_id": "SES-SIM-17",
            },
        },
        {
            "title": "High risk account drain",
            "category": "DECLINE",
            "payload": {
                "transaction_id": "TX-140135",
                "account_id": "C1655503661",
                "type": "CASH_OUT",
                "amount": 2988103.3,
                "oldbalanceOrg": 2988103.3,
                "newbalanceOrig": 0.0,
                "oldbalanceDest": 1402954.55,
                "newbalanceDest": 4391057.85,
                "payment_attempts": 1,
                "device_id": "DEV-SIM-360",
                "session_id": "SES-SIM-40135",
            },
        },
        {
            "title": "High risk syndicate transfer",
            "category": "DECLINE",
            "payload": {
                "transaction_id": "TX-100002",
                "account_id": "C1711670940",
                "type": "TRANSFER",
                "amount": 305627.0,
                "oldbalanceOrg": 305627.0,
                "newbalanceOrig": 0.0,
                "oldbalanceDest": 0.0,
                "newbalanceDest": 0.0,
                "payment_attempts": 1,
                "device_id": "DEV-SIM-807",
                "session_id": "SES-SIM-2",
            },
        },
    ]

    try:
        if "transactions" in inspect(db.get_bind()).get_table_names():
            def fetch_preset(query_text, params, title, category):
                row = db.execute(text(query_text), params).mappings().first()
                if row:
                    return {
                        "title": title,
                        "category": category,
                        "payload": {
                            "transaction_id": str(row["transaction_id"]),
                            "account_id": str(row["account_id"]),
                            "type": str(row["type"]),
                            "amount": float(row["amount"]),
                            "oldbalanceOrg": float(row.get("oldbalance_org") or 0.0),
                            "newbalanceOrig": float(row.get("newbalance_orig") or 0.0),
                            "oldbalanceDest": float(row.get("oldbalance_dest") or 0.0),
                            "newbalanceDest": float(row.get("newbalance_dest") or 0.0),
                            "payment_attempts": int(row.get("payment_attempts") or 1),
                            "device_id": str(row["device_id"]) if row.get("device_id") else None,
                            "session_id": str(row["session_id"]) if row.get("session_id") else None,
                        },
                    }
                return None

            p1 = fetch_preset(
                """
                SELECT * FROM transactions 
                WHERE is_fraud = 0 AND risk_score <= 0.10 AND type = 'PAYMENT' 
                ORDER BY transaction_id ASC LIMIT 1
                """,
                {},
                "Low risk payment",
                "APPROVE",
            )
            p2 = fetch_preset(
                """
                SELECT * FROM transactions 
                WHERE risk_score BETWEEN 0.40 AND 0.65 AND type IN ('TRANSFER', 'CASH_OUT')
                ORDER BY transaction_id ASC LIMIT 1
                """,
                {},
                "Medium risk transfer",
                "REVIEW",
            )
            p3 = fetch_preset(
                """
                SELECT * FROM transactions 
                WHERE is_fraud = 1 AND risk_score >= 0.90 AND type = 'CASH_OUT' 
                ORDER BY amount DESC LIMIT 1
                """,
                {},
                "High risk account drain",
                "DECLINE",
            )
            p4 = fetch_preset(
                """
                SELECT * FROM transactions 
                WHERE is_fraud = 1 AND risk_score >= 0.90 AND type = 'TRANSFER' 
                ORDER BY transaction_id ASC LIMIT 1
                """,
                {},
                "High risk syndicate transfer",
                "DECLINE",
            )

            loaded = [p for p in (p1, p2, p3, p4) if p is not None]
            if loaded:
                return loaded
    except Exception:
        pass

    return default_presets


@router.post("/risk-assessments", response_model=RiskAssessmentResponse)
@limiter.limit("30/minute")
def assess_risk(payload: RiskAssessmentRequest, request: Request = None):
    try:
        started_at = perf_counter()
        result = risk_engine.evaluate_risk(payload.model_dump())
        latency_ms = (perf_counter() - started_at) * 1000
        record_inference_latency(latency_ms)

        return {
            **result,
            "transaction_id": payload.transaction_id,
            "latency_ms": latency_ms,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Risk evaluation failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred while evaluating transaction risk.",
        )