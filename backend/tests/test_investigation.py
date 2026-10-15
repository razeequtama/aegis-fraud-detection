from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.routes.investigation import (
    create_investigation_case,
    submit_analyst_feedback,
)
from app.db.session import Base
from app.models.models import TransactionModel
from app.schemas.investigation import AnalystFeedbackRequest, CaseCreateRequest


def test_analyst_feedback_is_persisted_to_case():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        db.add(
            TransactionModel(
                transaction_id="TX-FEEDBACK",
                account_id="ACC-FEEDBACK",
                amount=125.0,
            )
        )
        db.commit()

        case_response = create_investigation_case(
            CaseCreateRequest(transaction_id="TX-FEEDBACK"), db
        )
        case_id = case_response["data"].case_id
        feedback_response = submit_analyst_feedback(
            case_id,
            AnalystFeedbackRequest(
                analyst_id="analyst-1",
                label="confirmed_fraud",
                reasoning="Confirmed after review.",
            ),
            db,
        )

        assert feedback_response["message"]
        assert feedback_response["data"].feedback_label == "confirmed_fraud"
        assert feedback_response["data"].feedback_reasoning == "Confirmed after review."
        assert feedback_response["data"].status == "closed"

    engine.dispose()


def test_list_investigation_cases_and_urgent_alerts():
    from app.api.routes.investigation import (
        list_investigation_cases,
        get_urgent_alerts,
        update_investigation_case,
    )
    from app.schemas.investigation import CaseUpdateRequest

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        # Add transactions
        db.add_all([
            TransactionModel(
                transaction_id="TX-URGENT-1",
                account_id="ACC-URGENT-1",
                amount=500000.0,
                risk_score=0.98,
                is_fraud=1,
            ),
            TransactionModel(
                transaction_id="TX-CASE-1",
                account_id="ACC-CASE-1",
                amount=1000.0,
                risk_score=0.55,
                is_fraud=0,
            ),
        ])
        db.commit()

        # Create case for TX-CASE-1
        case_res = create_investigation_case(
            CaseCreateRequest(transaction_id="TX-CASE-1", assigned_analyst="Analyst-Jane"),
            db,
        )
        case_id = case_res["data"].case_id

        # Update case
        update_res = update_investigation_case(
            case_id,
            CaseUpdateRequest(status="in_review", notes="Investigating device linkage"),
            db,
        )
        assert update_res["data"].status == "in_review"
        assert update_res["data"].notes == "Investigating device linkage"

        # List cases
        cases_list = list_investigation_cases(db=db)
        assert cases_list["total"] >= 1
        assert cases_list["summary"]["in_review"] >= 1
        assert cases_list["data"][0]["transaction_id"] == "TX-CASE-1"

        # Urgent alerts
        urgent = get_urgent_alerts(limit=5, db=db)
        assert len(urgent["data"]) >= 1
        assert urgent["data"][0]["transaction_id"] == "TX-URGENT-1"

    engine.dispose()
