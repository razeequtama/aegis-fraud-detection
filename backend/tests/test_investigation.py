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
