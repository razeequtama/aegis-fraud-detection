import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.routes.risk import assess_risk
from app.db.session import Base
from app.models.models import InvestigationCaseModel, TransactionModel
from app.schemas.risk import RiskAssessmentRequest, RiskAssessmentResponse
from app.services.risk_engine import risk_engine


@pytest.mark.parametrize(
    ("decision", "risk_score"),
    [("approve", 0.2), ("review", 0.6), ("decline", 0.9)],
)
def test_risk_assessment_simulates_without_persisting(monkeypatch, decision, risk_score):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    monkeypatch.setattr(
        risk_engine,
        "evaluate_risk",
        lambda _payload: {
            "risk_score": risk_score,
            "decision": decision,
            "model_version": "test-model",
            "signals": [],
        },
    )
    payload = RiskAssessmentRequest(
        transaction_id="TX-RISK-APPROVE",
        account_id="ACC-RISK-001",
        amount=125.0,
    )

    with Session(engine) as db:
        result = assess_risk(payload)
        response = RiskAssessmentResponse(**result)

        assert db.get(TransactionModel, payload.transaction_id) is None
        assert db.query(InvestigationCaseModel).count() == 0
        assert result["risk_score"] == risk_score
        assert result["decision"] == decision
        assert response.transaction_id == payload.transaction_id
        assert response.model_version == "test-model"
        assert response.latency_ms >= 0

    engine.dispose()


def test_repeated_risk_assessments_do_not_create_transactions_or_cases(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    monkeypatch.setattr(
        risk_engine,
        "evaluate_risk",
        lambda _payload: {
            "risk_score": 0.6,
            "decision": "review",
            "model_version": "test-model",
            "signals": [],
        },
    )
    payload = RiskAssessmentRequest(
        transaction_id="TX-RISK-REVIEW",
        account_id="ACC-RISK-002",
        amount=250.0,
    )

    with Session(engine) as db:
        result = assess_risk(payload)
        repeated_result = assess_risk(payload)

        assert repeated_result["decision"] == "review"
        assert result["decision"] == "review"
        assert db.query(TransactionModel).count() == 0
        assert db.query(InvestigationCaseModel).count() == 0

    engine.dispose()
