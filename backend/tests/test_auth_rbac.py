import json
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import (
    create_access_token,
    decode_access_token,
    DEMO_PERSONAS,
    get_persona,
)
from app.api.deps import require_permission
from app.core.redis import clear_demo_reset_lock

test_client = TestClient(app, raise_server_exceptions=False)


def make_request(method: str, path: str, data: dict = None, token: str = None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = test_client.request(
        method=method,
        url=path,
        json=data if data is not None else None,
        headers=headers,
    )
    try:
        content = response.json()
    except Exception:
        content = {"raw": response.text}
    return response.status_code, content


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


def test_jwt_secret_key_mandatory_and_length_enforcement(monkeypatch):
    import importlib
    import app.core.security as sec

    # 1. Missing or empty JWT_SECRET_KEY safely falls back to demo simulation secret
    monkeypatch.setenv("JWT_SECRET_KEY", "")
    reloaded_demo = importlib.reload(sec)
    assert reloaded_demo.JWT_SECRET_KEY == sec.DEFAULT_DEMO_SECRET

    # 2. Key shorter than 32 characters must raise RuntimeError
    monkeypatch.setenv("JWT_SECRET_KEY", "short_secret_under_32_chars!")
    with pytest.raises(RuntimeError) as exc_short:
        importlib.reload(sec)
    assert "shorter than 32 characters" in str(exc_short.value)

    # 3. Valid key with >= 32 characters reloads successfully
    valid_key = "valid-test-secret-key-that-has-at-least-32-chars!"
    monkeypatch.setenv("JWT_SECRET_KEY", valid_key)
    reloaded = importlib.reload(sec)
    assert reloaded.JWT_SECRET_KEY == valid_key


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


def test_live_auth_flow_and_rbac_boundaries(monkeypatch):
    monkeypatch.setenv("APP_ENV", "demo")
    monkeypatch.setenv("ENABLE_DEMO_RESET", "true")
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

    # 5. SEC-01 & SEC-02 Proof: Anonymous requests to protected endpoints return 401 Unauthorized
    code, err_data = make_request("POST", "/api/v1/cases/CASE-TEST/feedback", {"label": "confirmed_fraud"})
    assert code == 401, f"Expected 401 Unauthorized without token, got {code}"

    code, err_data = make_request("POST", "/api/v1/replays", {"model_version": "aegis-v1", "threshold": 0.5})
    assert code == 401, f"Expected 401 Unauthorized without token, got {code}"

    code, err_data = make_request("POST", "/api/v1/system/reset-demo")
    assert code == 401, f"Expected 401 Unauthorized without token, got {code}"

    code, err_data = make_request("GET", "/api/v1/transactions")
    assert code == 401, f"Expected 401 Unauthorized for /transactions without token, got {code}"

    code, err_data = make_request("GET", "/api/v1/cases")
    assert code == 401, f"Expected 401 Unauthorized for /cases without token, got {code}"

    code, err_data = make_request("GET", "/api/v1/transactions/TX-100001/network")
    assert code == 401, f"Expected 401 Unauthorized for /network without token, got {code}"

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
    clear_demo_reset_lock()
    from app.core.limiter import limiter
    limiter.reset()
    try:
        from app.core.redis import redis_client, is_redis_available
        if is_redis_available():
            redis_client.delete("aegis:system:reset_demo:cooldown")
    except Exception:
        pass

    with patch("app.api.routes.system.reset_demo_state") as mock_reset:
        code, reset_res = make_request("POST", "/api/v1/system/reset-demo", token=analyst_token)
        assert code == 200
        assert reset_res["status"] == "success"
        mock_reset.assert_called_once()

        # 8. SEC-03 Proof: Immediate subsequent reset request triggers HTTP 429 Too Many Requests
        code, throttled_res = make_request("POST", "/api/v1/system/reset-demo", token=analyst_token)
        assert code == 429, f"Expected 429 Too Many Requests on immediate reset attempt, got {code}"
        detail_msg = throttled_res.get("detail", "") or throttled_res.get("error", "")
        assert "recently reset" in detail_msg or "Rate limit exceeded" in detail_msg

        # Reset rate limiter state so subsequent unit tests run in isolation
        from app.core.limiter import limiter
        limiter.reset()
        clear_demo_reset_lock()

    # 9. SEC-04 Proof: Out-of-bounds radius queries trigger HTTP 422 Unprocessable Entity
    code, radius_err = make_request("GET", "/api/v1/transactions/TX-100463/network?radius=4", token=analyst_token)
    assert code == 422, f"Expected 422 Unprocessable Entity for radius=4, got {code}"

    code, radius_err = make_request("GET", "/api/v1/transactions/TX-100463/network?radius=0", token=analyst_token)
    assert code == 422, f"Expected 422 Unprocessable Entity for radius=0, got {code}"

    # 10. SEC-10 Proof: Public /health is minimal and authenticated /system/diagnostics contains telemetry
    code, public_health = make_request("GET", "/api/v1/health")
    assert code == 200
    assert public_health["version"] == "1.0.0"
    assert "database" not in public_health, "Public health endpoint must not expose database pool topology"
    assert "redis" not in public_health, "Public health endpoint must not expose redis hosts or ports"

    code, unauth_diag = make_request("GET", "/api/v1/system/diagnostics")
    assert code == 401, f"Expected 401 Unauthorized for anonymous diagnostics query, got {code}"

    code, auth_diag = make_request("GET", "/api/v1/system/diagnostics", token=analyst_token)
    assert code == 200
    assert "database" in auth_diag and "pool" in auth_diag["database"]
    assert "redis" in auth_diag and "host" in auth_diag["redis"]
