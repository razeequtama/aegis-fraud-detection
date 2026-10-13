from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import MetaData, String, Table, cast, inspect, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.graph_analysis import FraudGraphAnalyzer

router = APIRouter(prefix="/api/v1", tags=["Network Analysis"])


def _build_analyzer(db: Session) -> FraudGraphAnalyzer:
    if "transactions" not in inspect(db.get_bind()).get_table_names():
        raise HTTPException(status_code=404, detail="No transaction data is available for graph analysis.")

    table = Table("transactions", MetaData(), autoload_with=db.get_bind())
    columns = table.c
    account_column = next(
        (columns[name] for name in ("account_id", "name_orig") if name in columns),
        None,
    )
    device_column = next(
        (columns[name] for name in ("device_id", "name_device") if name in columns),
        None,
    )
    session_column = next(
        (columns[name] for name in ("session_id", "name_session") if name in columns),
        None,
    )
    fraud_column = next(
        (
            columns[name]
            for name in ("is_fraud", "label", "is_flagged_fraud")
            if name in columns
        ),
        None,
    )
    if "transaction_id" not in columns or account_column is None:
        raise HTTPException(
            status_code=500,
            detail="The transactions table is missing transaction or account identifiers.",
        )

    selected = [
        columns.transaction_id.label("transaction_id"),
        account_column.label("account_id"),
    ]
    selected.append(
        device_column.label("device_id") if device_column is not None else None
    )
    selected.append(
        session_column.label("session_id") if session_column is not None else None
    )
    selected.append(
        fraud_column.label("is_fraud") if fraud_column is not None else None
    )
    statement = select(*(column for column in selected if column is not None))
    records = [
        dict(row)
        for row in db.execute(statement).mappings().all()
    ]

    analyzer = FraudGraphAnalyzer()
    analyzer.build_graph_from_transactions(records)
    return analyzer


@router.get("/transactions/{transaction_id}/network")
def get_transaction_network(
    transaction_id: str, radius: int = 2, db: Session = Depends(get_db)
):
    """
    Retrieves the connected neighborhood graph for a specific transaction.
    """
    entity_id = f"Transaction:{transaction_id}"
    analyzer = _build_analyzer(db)
    network_data = analyzer.get_entity_neighborhood(entity_id, radius=radius)
    
    if not network_data["nodes"]:
        raise HTTPException(status_code=404, detail="Transaction network not found or empty.")
    
    return network_data

@router.get("/accounts/{account_id}/network")
def get_account_network(
    account_id: str, radius: int = 2, db: Session = Depends(get_db)
):
    """
    Retrieves the connected neighborhood graph for a specific account (shared devices, sessions).
    """
    entity_id = f"Account:{account_id}"
    analyzer = _build_analyzer(db)
    network_data = analyzer.get_entity_neighborhood(entity_id, radius=radius)
    
    if not network_data["nodes"]:
        raise HTTPException(status_code=404, detail="Account network not found.")
    
    return network_data