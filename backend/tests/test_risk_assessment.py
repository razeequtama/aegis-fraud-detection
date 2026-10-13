from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.routes.risk import assess_risk
from app.db.session import Base
from app.models.models import InvestigationCaseModel, TransactionModel
from app.schemas.risk import RiskAssessmentRequest, RiskAssessmentResponse
from app.services.risk_engine import risk_engine


def test_risk_assessment_persists_transaction_and_returns_response(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    monkeypatch.setattr(
        risk_engine,
        "evaluate_risk",
        lambda _payload: {
            "risk_score": 0.2,
            "decision": "approve",
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
        result = assess_risk(payload, db)
        response = RiskAssessmentResponse(**result)

        transaction = db.get(TransactionModel, payload.transaction_id)
        assert transaction is not None
        assert transaction.account_id == payload.account_id
        assert transaction.label == "approve"
        assert response.transaction_id == payload.transaction_id
        assert response.model_version == "test-model"
        assert response.latency_ms >= 0

    engine.dispose()


def test_risk_assessment_persists_transaction_before_creating_case(monkeypatch):
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
        result = assess_risk(payload, db)

        transaction = db.get(TransactionModel, payload.transaction_id)
        case = (
            db.query(InvestigationCaseModel)
            .filter_by(transaction_id=payload.transaction_id)
            .one()
        )
        assert transaction is not None
        assert result["decision"] == "review"
        assert case.status == "open"

    engine.dispose()
