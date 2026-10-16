import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict, List, Optional

# Secret key for JWT signing; defaults to a secure demo secret if not set in process environment
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "aegis-platform-demo-secret-key-32-chars-minimum")
TOKEN_EXPIRATION_SECONDS = int(os.environ.get("JWT_EXPIRATION_SECONDS", 86400 * 7))  # 7 days for demo usability

# Demo personas configuration with clear Role-Based Access Control (RBAC) permissions
DEMO_PERSONAS: Dict[str, Dict[str, Any]] = {
    "senior_analyst": {
        "user_id": "analyst_sarah",
        "username": "sjenkins",
        "name": "Sarah Jenkins",
        "title": "Senior Fraud Specialist",
        "badge": "Full Access",
        "badge_color": "cyan",
        "role": "lead_analyst",
        "avatar": "SJ",
        "permissions": ["view", "edit_case", "label_feedback", "run_replay", "reset_demo"],
        "description": "Unrestricted investigation authority: triage, case reassignment, confirmed fraud labeling, and historical replays.",
    },
    "compliance_officer": {
        "user_id": "compliance_alex",
        "username": "achen",
        "name": "Alex Chen",
        "title": "Compliance & Risk Officer",
        "badge": "Review Only",
        "badge_color": "purple",
        "role": "compliance_officer",
        "avatar": "AC",
        "permissions": ["view", "edit_case", "run_replay"],
        "description": "Operational review authority: inspect cases, update analyst notes, and trigger simulation runs (cannot label final ML ground-truth).",
    },
    "auditor_readonly": {
        "user_id": "auditor_guest",
        "username": "guest_auditor",
        "name": "Guest Auditor",
        "title": "External Compliance Auditor",
        "badge": "Read-Only",
        "badge_color": "slate",
        "role": "auditor",
        "avatar": "GA",
        "permissions": ["view"],
        "description": "Read-only inspection authority: monitor command center metrics, transaction graphs, and risk scores with zero modification rights.",
    },
}


def _b64_encode(data: bytes) -> str:
    """URL-safe Base64 encode without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64_decode(data: str) -> bytes:
    """URL-safe Base64 decode with proper padding restoration."""
    padding = len(data) % 4
    if padding:
        data += "=" * (4 - padding)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(payload: Dict[str, Any], expires_in: int = TOKEN_EXPIRATION_SECONDS) -> str:
    """Creates a standard RFC 7519 HMAC-SHA256 JWT access token without external dependencies."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())

    full_payload = {
        **payload,
        "iat": now,
        "exp": now + expires_in,
    }

    header_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64_encode(json.dumps(full_payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(JWT_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates an HMAC-SHA256 JWT access token. Returns payload dict or None if invalid/expired."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

        expected_sig = hmac.new(JWT_SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_bytes = _b64_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Verify expiration
        exp = payload.get("exp")
        if exp and int(exp) < int(time.time()):
            return None

        return payload
    except Exception:
        return None


def get_persona(persona_key: str) -> Optional[Dict[str, Any]]:
    """Retrieves a persona definition by its key (e.g., 'senior_analyst')."""
    return DEMO_PERSONAS.get(persona_key.lower().strip())

