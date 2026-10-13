from fastapi import APIRouter, HTTPException
from app.services.graph_analysis import graph_analyzer

router = APIRouter(prefix="/api/v1", tags=["Network Analysis"])

@router.get("/transactions/{transaction_id}/network")
def get_transaction_network(transaction_id: str, radius: int = 2):
    """
    Retrieves the connected neighborhood graph for a specific transaction.
    """
    entity_id = f"Transaction:{transaction_id}"
    network_data = graph_analyzer.get_entity_neighborhood(entity_id, radius=radius)
    
    if not network_data["nodes"]:
        raise HTTPException(status_code=404, detail="Transaction network not found or empty.")
    
    return network_data

@router.get("/accounts/{account_id}/network")
def get_account_network(account_id: str, radius: int = 2):
    """
    Retrieves the connected neighborhood graph for a specific account (shared devices, sessions).
    """
    entity_id = f"Account:{account_id}"
    network_data = graph_analyzer.get_entity_neighborhood(entity_id, radius=radius)
    
    if not network_data["nodes"]:
        raise HTTPException(status_code=404, detail="Account network not found.")
    
    return network_data