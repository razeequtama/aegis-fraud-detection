from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.security import DEMO_PERSONAS, create_access_token, get_persona

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & Personas"])


class DemoLoginRequest(BaseModel):
    persona: str = Field(
        ...,
        max_length=64,
        description="Key of the demo persona: 'senior_analyst', 'compliance_officer', or 'auditor_readonly'",
        examples=["senior_analyst"],
    )


class PersonaResponse(BaseModel):
    key: str
    name: str
    title: str
    badge: str
    badge_color: str
    role: str
    avatar: str
    permissions: List[str]
    description: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


@router.get("/personas", response_model=List[PersonaResponse])
def list_available_personas():
    """Lists all available 1-click demo personas and their RBAC permissions."""
    return [
        {
            "key": key,
            **details,
        }
        for key, details in DEMO_PERSONAS.items()
    ]


@router.post("/demo-login", response_model=LoginResponse)
def demo_login(payload: DemoLoginRequest):
    """
    1-Click Demo Login endpoint. Issues a signed JWT access token for the selected persona.
    Eliminates registration barriers while establishing an authenticated session with verified RBAC roles.
    """
    persona = get_persona(payload.persona)
    if not persona:
        valid_options = ", ".join(DEMO_PERSONAS.keys())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown persona '{payload.persona}'. Valid demo personas are: {valid_options}",
        )

    token_payload = {
        "sub": persona["user_id"],
        "user_id": persona["user_id"],
        "username": persona["username"],
        "name": persona["name"],
        "title": persona["title"],
        "role": persona["role"],
        "persona_key": payload.persona,
        "permissions": persona["permissions"],
    }

    token = create_access_token(token_payload)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": token_payload,
    }


@router.get("/me")
def get_authenticated_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Returns the verified profile and RBAC permissions of the current session."""
    return {"user": current_user}

