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


def test_risk_assessment_triggers_high_velocity_burst(monkeypatch):
    monkeypatch.setattr(
        "app.services.risk_engine.check_transaction_velocity",
        lambda account_id, window_seconds=60: 5,
    )
    result = risk_engine.evaluate_transaction({
        "transaction_id": "TX-BURST-001",
        "account_id": "ACC-BURST",
        "amount": 50.0,
        "type": "PAYMENT",
    })
    signal_names = [s["name"] for s in result["signals"]]
    assert "high_velocity_burst" in signal_names
    assert result["velocity"] == 5
    assert result["risk_score"] >= 0.35


def test_risk_assessment_triggers_repeated_payment_attempts():
    result = risk_engine.evaluate_transaction({
        "transaction_id": "TX-ATTEMPTS-001",
        "account_id": "ACC-ATTEMPTS",
        "amount": 100.0,
        "type": "PAYMENT",
        "payment_attempts": 3,
    })
    signal_names = [s["name"] for s in result["signals"]]
    assert "high_payment_attempts" in signal_names


def test_get_risk_assessment_presets():
    from app.api.routes.risk import get_risk_assessment_presets
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        presets = get_risk_assessment_presets(db=db)
        assert len(presets) >= 3
        for preset in presets:
            assert "title" in preset
            assert "category" in preset
            assert "payload" in preset
            assert "transaction_id" in preset["payload"]
            assert "amount" in preset["payload"]
            assert not preset["payload"]["transaction_id"].startswith("TX-SAMPLE-")
    engine.dispose()


def test_risk_assessment_indonesian_signals():
    # Test Indonesian signal output
    result_id = risk_engine.evaluate_transaction({
        "transaction_id": "TX-ID-TEST",
        "account_id": "C123456",
        "amount": 1500000.0,
        "oldbalanceOrg": 1500000.0,
        "newbalanceOrig": 0.0,
        "language": "id",
    })
    signals_id = result_id["signals"]
    assert len(signals_id) > 0
    # First signal is high_fraud_probability
    assert signals_id[0]["name"] == "high_fraud_probability"
    assert "penipuan" in signals_id[0]["description"]
    # Account drain signal in Indonesian
    drain_sig = next(s for s in signals_id if s["name"] == "critical_account_drain")
    assert "Pengurasan saldo akun" in drain_sig["description"]

    # Test English signal output
    result_en = risk_engine.evaluate_transaction({
        "transaction_id": "TX-EN-TEST",
        "account_id": "C123456",
        "amount": 1500000.0,
        "oldbalanceOrg": 1500000.0,
        "newbalanceOrig": 0.0,
        "language": "en",
    })
    signals_en = result_en["signals"]
    assert signals_en[0]["name"] == "high_fraud_probability"
    assert "critical probability of fraudulent" in signals_en[0]["description"]
    drain_sig_en = next(s for s in signals_en if s["name"] == "critical_account_drain")
    assert "Near-total account drain detected" in drain_sig_en["description"]


def test_assess_risk_masks_internal_exceptions(monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setattr(
        risk_engine,
        "evaluate_risk",
        lambda _payload: (_ for _ in ()).throw(
            RuntimeError("SensitiveInternalNumPyCrash: shape mismatch at /app/ml/artifacts/scaler.joblib")
        ),
    )
    payload = RiskAssessmentRequest(
        transaction_id="TX-CRASH-TEST",
        account_id="ACC-CRASH",
        amount=500.0,
    )

    with pytest.raises(HTTPException) as exc_info:
        assess_risk(payload)

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "An internal error occurred while evaluating transaction risk."
    assert "SensitiveInternalNumPyCrash" not in exc_info.value.detail
    assert "/app/ml/artifacts" not in exc_info.value.detail


