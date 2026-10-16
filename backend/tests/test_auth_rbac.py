import json
import urllib.request
import urllib.error
import pytest
from fastapi import HTTPException
from app.core.security import (
    create_access_token,
    decode_access_token,
    DEMO_PERSONAS,
    get_persona,
)
from app.api.deps import require_permission

BASE_URL = "http://127.0.0.1:8000"


def make_request(method: str, path: str, data: dict = None, token: str = None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            status = res.status
            content = res.read().decode("utf-8")
            return status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"raw": err_body}
        return e.code, parsed


def test_security_core_token_encoding_and_decoding():
    analyst_persona = get_persona("senior_analyst")
    assert analyst_persona is not None
    assert "label_feedback" in analyst_persona["permissions"]

    token = create_access_token({
        "sub": analyst_persona["user_id"],
        "name": analyst_persona["name"],
        "role": analyst_persona["role"],
        "permissions": analyst_persona["permissions"],
    })
    assert isinstance(token, str)
    assert len(token.split(".")) == 3

    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == analyst_persona["user_id"]
    assert decoded["role"] == "lead_analyst"
    assert "label_feedback" in decoded["permissions"]


def test_security_tampered_token_rejection():
    token = create_access_token({"sub": "USR-1", "permissions": ["view"]})
    parts = token.split(".")
    # Tamper with signature
    tampered_sig = parts[0] + "." + parts[1] + "." + "invalid_signature_hex"
    assert decode_access_token(tampered_sig) is None

    # Tamper with payload
    tampered_payload = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJoYWNrZWQifQ." + parts[2]
    assert decode_access_token(tampered_payload) is None


def test_rbac_dependency_permission_enforcement():
    analyst_user = {
        "user_id": "USR-1",
        "name": "Sarah",
        "role": "lead_analyst",
        "permissions": ["view", "edit_case", "label_feedback", "run_replay", "reset_demo"],
    }
    auditor_user = {
        "user_id": "USR-3",
        "name": "Auditor",
        "role": "auditor",
        "permissions": ["view"],
    }

    # Senior Analyst passes all checks
    check_feedback = require_permission("label_feedback")
    assert check_feedback(analyst_user) == analyst_user

    check_replay = require_permission("run_replay")
    assert check_replay(analyst_user) == analyst_user

    # Auditor fails feedback and replay with HTTP 403
    with pytest.raises(HTTPException) as exc_info:
        check_feedback(auditor_user)
    assert exc_info.value.status_code == 403
    assert "does not have 'label_feedback' permission" in exc_info.value.detail

    with pytest.raises(HTTPException) as exc_info2:
        check_replay(auditor_user)
    assert exc_info2.value.status_code == 403
    assert "does not have 'run_replay' permission" in exc_info2.value.detail


def test_live_auth_flow_and_rbac_boundaries():
    # 1. Fetch personas
    code, personas = make_request("GET", "/api/v1/auth/personas")
    assert code == 200
    assert len(personas) >= 3
    keys = [p["key"] for p in personas]
    assert "senior_analyst" in keys
    assert "compliance_officer" in keys
    assert "auditor_readonly" in keys

    # 2. 1-Click login as senior analyst
    code, login_analyst = make_request("POST", "/api/v1/auth/demo-login", {"persona": "senior_analyst"})
    assert code == 200
    analyst_token = login_analyst["access_token"]
    assert analyst_token
    assert login_analyst["user"]["role"] == "lead_analyst"

    # 3. 1-Click login as auditor
    code, login_auditor = make_request("POST", "/api/v1/auth/demo-login", {"persona": "auditor_readonly"})
    assert code == 200
    auditor_token = login_auditor["access_token"]
    assert auditor_token
    assert login_auditor["user"]["role"] == "auditor"

    # 4. Verify /auth/me returns current session
    code, me_data = make_request("GET", "/api/v1/auth/me", token=analyst_token)
    assert code == 200
    assert me_data["user"]["role"] == "lead_analyst"

    # 5. SEC-01 Proof: Anonymous request to protected endpoints return 401 Unauthorized
    code, err_data = make_request("POST", "/api/v1/cases/CASE-TEST/feedback", {"label": "confirmed_fraud"})
    assert code == 401, f"Expected 401 Unauthorized without token, got {code}"

    code, err_data = make_request("POST", "/api/v1/replays", {"model_version": "aegis-v1", "threshold": 0.5})
    assert code == 401, f"Expected 401 Unauthorized without token, got {code}"

    code, err_data = make_request("POST", "/api/v1/system/reset-demo")
    assert code == 401, f"Expected 401 Unauthorized without token, got {code}"

    # 6. RBAC Proof: Auditor attempting mutations returns 403 Forbidden
    code, err_data = make_request(
        "POST",
        "/api/v1/cases/CASE-TEST/feedback",
        {"label": "confirmed_fraud", "reasoning": "auditor test"},
        token=auditor_token,
    )
    assert code == 403, f"Expected 403 Forbidden for auditor feedback, got {code}"
    assert "label_feedback" in err_data.get("detail", "")

    code, err_data = make_request(
        "POST",
        "/api/v1/system/reset-demo",
        token=auditor_token,
    )
    assert code == 403, f"Expected 403 Forbidden for auditor demo reset, got {code}"
    assert "reset_demo" in err_data.get("detail", "")

    # 7. Senior Analyst authorized to reset demo state
    code, reset_res = make_request("POST", "/api/v1/system/reset-demo", token=analyst_token)
    assert code == 200
    assert reset_res["status"] == "success"

