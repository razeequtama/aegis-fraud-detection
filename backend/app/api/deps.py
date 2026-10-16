from typing import Callable, Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token

# HTTPBearer security scheme for Swagger UI and header authorization extraction
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    """
    Extracts, validates, and decodes the JWT bearer token from the Authorization header.
    Fails with HTTP 401 if missing, expired, or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please select an analyst persona to authenticate.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired or is invalid. Please select an analyst persona to refresh your session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[Dict[str, Any]]:
    """Returns the decoded user payload if valid token is present; otherwise returns None."""
    if not credentials or not credentials.credentials:
        return None
    return decode_access_token(credentials.credentials)


def require_permission(required_permission: str) -> Callable:
    """
    Dependency factory enforcing Role-Based Access Control (RBAC).
    Verifies that the authenticated persona possesses the required permission.
    Returns HTTP 403 Forbidden with actionable user guidance if missing.
    """
    def permission_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_permissions = current_user.get("permissions", [])
        if required_permission not in user_permissions:
            role_name = current_user.get("role", "unknown")
            user_name = current_user.get("name", "User")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access Denied: Persona '{user_name}' ({role_name}) does not have "
                    f"'{required_permission}' permission. "
                    "Switch to 'Senior Fraud Analyst' in the top header to perform this action."
                ),
            )
        return current_user

    return permission_checker

