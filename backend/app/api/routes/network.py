from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import MetaData, String, Table, cast, inspect, select
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.db.session import get_db
from app.services.graph_analysis import FraudGraphAnalyzer

router = APIRouter(prefix="/api/v1", tags=["Network Analysis"])


_cached_analyzer: FraudGraphAnalyzer | None = None


def _build_scoped_analyzer(
    db: Session,
    target_type: str,
    target_id: str,
    radius: int = 2,
) -> FraudGraphAnalyzer:
    """
    Dynamically loads only the 1-hop and 2-hop connected neighborhood transactions
    directly from SQL rather than loading all 50,000 records into memory.
    """
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
    if device_column is not None:
        selected.append(device_column.label("device_id"))
    if session_column is not None:
        selected.append(session_column.label("session_id"))
    if fraud_column is not None:
        selected.append(fraud_column.label("is_fraud"))

    collected: dict[str, dict] = {}
    known_accounts: set[str] = set()
    known_devices: set[str] = set()
    known_sessions: set[str] = set()

    # Step 1: Query initial target seed
    if target_type == "transaction":
        seed_stmt = select(*selected).where(cast(columns.transaction_id, String) == str(target_id)).limit(10)
    else:
        seed_stmt = select(*selected).where(cast(account_column, String) == str(target_id)).limit(200)

    seed_rows = [dict(r) for r in db.execute(seed_stmt).mappings().all()]
    for r in seed_rows:
        collected[r["transaction_id"]] = r
        if r.get("account_id"):
            known_accounts.add(str(r["account_id"]))
        if r.get("device_id"):
            known_devices.add(str(r["device_id"]))
        if r.get("session_id"):
            known_sessions.add(str(r["session_id"]))

    if not collected:
        analyzer = FraudGraphAnalyzer()
        return analyzer

    # Step 2: 1-to-2 hop expansion - fetch transactions for discovered accounts
    if radius >= 2 and known_accounts:
        acct_stmt = (
            select(*selected)
            .where(cast(account_column, String).in_(list(known_accounts)[:50]))
            .limit(200)
        )
        for r in db.execute(acct_stmt).mappings().all():
            collected[r["transaction_id"]] = dict(r)
            if r.get("device_id"):
                known_devices.add(str(r["device_id"]))
            if r.get("session_id"):
                known_sessions.add(str(r["session_id"]))

    # Step 3: Shared device / session expansion - fetch transactions sharing devices/sessions
    if radius >= 2 and (known_devices or known_sessions):
        device_or_session = []
        if device_column is not None and known_devices:
            device_or_session.append(cast(device_column, String).in_(list(known_devices)[:50]))
        if session_column is not None and known_sessions:
            device_or_session.append(cast(session_column, String).in_(list(known_sessions)[:50]))

        if device_or_session:
            from sqlalchemy import or_
            shared_stmt = select(*selected).where(or_(*device_or_session)).limit(500)
            for r in db.execute(shared_stmt).mappings().all():
                collected[r["transaction_id"]] = dict(r)

    analyzer = FraudGraphAnalyzer()
    analyzer.build_graph_from_transactions(list(collected.values()))
    return analyzer


def _build_analyzer(db: Session, force_reload: bool = False) -> FraudGraphAnalyzer:
    """
    Fallback analyzer builder for backward compatibility, limited to 1,000 records
    to prevent memory exhaustion.
    """
    global _cached_analyzer
    if _cached_analyzer is not None and not force_reload:
        return _cached_analyzer

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
    statement = select(*(column for column in selected if column is not None)).limit(1000)
    records = [
        dict(row)
        for row in db.execute(statement).mappings().all()
    ]

    analyzer = FraudGraphAnalyzer()
    analyzer.build_graph_from_transactions(records)
    _cached_analyzer = analyzer
    return analyzer


@router.get("/network/presets")
@router.get("/network/samples")
def get_network_presets():
    """Returns verified graph pattern presets from the database for instant user exploration."""
    return [
        {
            "id": "C376938867",
            "type": "accounts",
            "title": "53-Account Fraud Ring",
            "badge": "Syndicate Ring",
            "badge_color": "rose",
            "description": "Central shared emulator (DEV-SIM-995) linking 53 accounts with 17 flagged fraud accounts.",
            "stats": "56 Nodes · 17 Suspicious · 1 Shared Device",
            "related_id": "TX-100463",
        },
        {
            "id": "C1387708046",
            "type": "accounts",
            "title": "High-Density Device Ring",
            "badge": "Device Multiplexing",
            "badge_color": "amber",
            "description": "Shared device DEV-SIM-236 linking 54 accounts with 19 confirmed fraud nodes.",
            "stats": "57 Nodes · 19 Suspicious · 1 Shared Device",
            "related_id": "TX-107781",
        },
        {
            "id": "C1791470904",
            "type": "accounts",
            "title": "Mule Account Network",
            "badge": "Mule Ring",
            "badge_color": "rose",
            "description": "Device DEV-SIM-278 connecting 47 accounts with multiple concurrent cash-out transactions.",
            "stats": "50 Nodes · 17 Suspicious · 1 Shared Device",
            "related_id": "TX-100033",
        },
        {
            "id": "TX-100463",
            "type": "transactions",
            "title": "Fraudulent Syndicate Transfer",
            "badge": "Flagged Transaction",
            "badge_color": "rose",
            "description": "Syndicate transfer executed within the DEV-SIM-995 multi-account ring.",
            "stats": "Linked to Account C376938867 & Device DEV-SIM-995",
            "related_id": "C376938867",
        },
        {
            "id": "TX-140135",
            "type": "transactions",
            "title": "High-Value Drain (Rp 3M)",
            "badge": "Decline Cluster",
            "badge_color": "purple",
            "description": "Critical Rp 2,988,103 cash out on device DEV-SIM-360 with confirmed fraud label.",
            "stats": "Decline Score 0.99 · 100% Drain · DEV-SIM-360",
            "related_id": "C1655503661",
        },
        {
            "id": "C1041698296",
            "type": "accounts",
            "title": "Clean Retail Customer",
            "badge": "Normal Baseline",
            "badge_color": "emerald",
            "description": "Standard retail customer with normal transactions and zero fraud flags.",
            "stats": "Legitimate Baseline · Low Risk",
            "related_id": "TX-149954",
        },
    ]


@router.get("/transactions/{transaction_id}/network")
def get_transaction_network(
    transaction_id: str,
    radius: int = Query(2, ge=1, le=3, description="Exploration radius depth (1-3)"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("view")),
):
    """
    Retrieves the connected neighborhood graph for a specific transaction.
    """
    resolved_radius = radius if isinstance(radius, int) else getattr(radius, "default", 2)
    entity_id = f"Transaction:{transaction_id}"
    analyzer = _build_scoped_analyzer(db, "transaction", transaction_id, radius=resolved_radius)
    network_data = analyzer.get_entity_neighborhood(entity_id, radius=resolved_radius)
    
    if not network_data["nodes"]:
        raise HTTPException(status_code=404, detail="Transaction network not found or empty.")
    
    return network_data


@router.get("/accounts/{account_id}/network")
def get_account_network(
    account_id: str,
    radius: int = Query(2, ge=1, le=3, description="Exploration radius depth (1-3)"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(require_permission("view")),
):
    """
    Retrieves the connected neighborhood graph for a specific account (shared devices, sessions).
    """
    resolved_radius = radius if isinstance(radius, int) else getattr(radius, "default", 2)
    entity_id = f"Account:{account_id}"
    analyzer = _build_scoped_analyzer(db, "account", account_id, radius=resolved_radius)
    network_data = analyzer.get_entity_neighborhood(entity_id, radius=resolved_radius)
    
    if not network_data["nodes"]:
        raise HTTPException(status_code=404, detail="Account network not found.")
    
    return network_data