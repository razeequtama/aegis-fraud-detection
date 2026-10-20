import os
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.main import on_startup
from app.db.seed import reset_demo_state
from app.api.routes.system import trigger_demo_reset


def test_reset_demo_state_strictly_forbidden_in_production(monkeypatch):
    """
    DATA-01 Verification:
    Direct invocation of reset_demo_state() must refuse to delete tables in production.
    """
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("ENABLE_DEMO_RESET", raising=False)

    with pytest.raises(PermissionError) as exc_info:
        reset_demo_state()

    assert "production environments" in str(exc_info.value).lower()


def test_reset_demo_state_disabled_without_explicit_opt_in(monkeypatch):
    """
    DATA-01 Verification:
    Environments other than 'demo' must not allow reset without explicit ENABLE_DEMO_RESET=true.
    """
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.delenv("ENABLE_DEMO_RESET", raising=False)

    with pytest.raises(PermissionError) as exc_info:
        reset_demo_state()

    assert "disabled in environment 'staging'" in str(exc_info.value)


def test_startup_disables_background_cron_in_production(monkeypatch):
    """
    DATA-01 Verification:
    When APP_ENV=production, on_startup must never spawn the schedule_daily_demo_reset background coroutine.
    """
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ENABLE_DEMO_RESET", "true")  # Even if mistakenly set in .env

    with patch("asyncio.create_task") as mock_create_task:
        asyncio.run(on_startup())
        mock_create_task.assert_not_called()


def test_startup_enables_cron_only_in_demo_with_flag(monkeypatch):
    """
    DATA-01 Verification:
    When APP_ENV=demo and ENABLE_DEMO_RESET=true, startup schedules the reset task.
    """
    monkeypatch.setenv("APP_ENV", "demo")
    monkeypatch.setenv("ENABLE_DEMO_RESET", "true")

    with patch("asyncio.create_task") as mock_create_task:
        asyncio.run(on_startup())
        mock_create_task.assert_called_once()


def test_api_system_reset_demo_forbidden_in_production(monkeypatch):
    """
    DATA-01 Verification:
    The endpoint logic for /api/v1/system/reset-demo must return 403 Forbidden in production.
    """
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("ENABLE_DEMO_RESET", raising=False)

    from starlette.requests import Request
    from app.core.limiter import limiter
    limiter.reset()
    mock_request = Request({"type": "http", "path": "/api/v1/system/reset-demo", "client": ("192.0.2.1", 12345), "headers": []})
    user = {"name": "Sarah Jenkins", "role": "lead_analyst", "permissions": ["reset_demo"]}

    with pytest.raises(HTTPException) as exc_info:
        trigger_demo_reset(request=mock_request, current_user=user)

    assert exc_info.value.status_code == 403
    assert "production environments" in exc_info.value.detail.lower()


def test_reset_demo_state_force_override_for_admin_recovery(monkeypatch):
    """
    DATA-01 Verification:
    An explicit force=True allows recovery scripts to execute if explicitly requested by an admin.
    """
    monkeypatch.setenv("APP_ENV", "production")
    with patch("app.db.seed.seed_investigation_cases") as mock_seed, \
         patch("app.db.seed.engine.begin") as mock_engine_begin:
        
        mock_conn = MagicMock()
        mock_engine_begin.return_value.__enter__.return_value = mock_conn

        # Should not raise when force=True
        reset_demo_state(force=True)
        assert mock_conn.execute.called
        assert mock_seed.called

