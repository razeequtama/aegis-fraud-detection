import functools
import inspect
import logging
import os
from typing import Optional
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.redis import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, is_redis_available

logger = logging.getLogger("aegis.limiter")


def get_client_ip(request: Request) -> str:
    """
    Extracts the client IP address, respecting X-Forwarded-For if behind a reverse proxy (e.g. Nginx).
    Falls back to request.client.host or get_remote_address.
    """
    if request is None:
        return "127.0.0.1"

    forwarded = getattr(request, "headers", {}).get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip

    if getattr(request, "client", None) and request.client.host:
        return request.client.host

    return get_remote_address(request)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Standardized FastAPI handler for RateLimitExceeded exceptions.
    Returns HTTP 429 with both 'detail' (FastAPI standard) and 'error' keys,
    injecting Retry-After headers.
    """
    detail = f"Rate limit exceeded: {exc.detail}"
    response = JSONResponse(
        status_code=429,
        content={"detail": detail, "error": detail},
    )
    if hasattr(request.app.state, "limiter"):
        view_rate_limit = getattr(getattr(request, "state", None), "view_rate_limit", None)
        response = request.app.state.limiter._inject_headers(response, view_rate_limit)
    return response


class SafeLimiter(Limiter):
    """
    Custom SlowAPI Limiter that transparently supports:
    1. ASGI HTTP requests with distributed Redis rate limiting (and memory fallback).
    2. Direct unit test invocations where endpoints are called as regular Python functions.
    """

    def limit(self, *args, **kwargs):
        decorator = super().limit(*args, **kwargs)

        def wrapper(func):
            decorated = decorator(func)
            sig = inspect.signature(func)
            request_param_name = None
            for param in sig.parameters.values():
                if param.name in ("request", "websocket"):
                    request_param_name = param.name
                    break

            @functools.wraps(func)
            def safe_call(*call_args, **call_kwargs):
                req = call_kwargs.get(request_param_name)
                if req is None and request_param_name is not None:
                    param_names = list(sig.parameters.keys())
                    if request_param_name in param_names:
                        idx = param_names.index(request_param_name)
                        if len(call_args) > idx:
                            req = call_args[idx]

                # If invoked directly without a Starlette Request instance (e.g. unit tests):
                if not isinstance(req, Request):
                    return func(*call_args, **call_kwargs)

                return decorated(*call_args, **call_kwargs)

            return safe_call

        return wrapper


def create_limiter() -> SafeLimiter:
    """
    Creates a Limiter configured with Redis backend when reachable and authenticated,
    falling back to memory storage for test suites and offline environments.
    """
    if os.getenv("TESTING") == "1":
        return SafeLimiter(key_func=get_client_ip, storage_uri="memory://")

    # If Redis is reachable, configure Redis storage (db=1 for rate limit keys)
    if is_redis_available():
        auth_part = f":{REDIS_PASSWORD}@" if REDIS_PASSWORD else ""
        redis_uri = f"redis://{auth_part}{REDIS_HOST}:{REDIS_PORT}/1"
        try:
            return SafeLimiter(
                key_func=get_client_ip,
                storage_uri=redis_uri,
                in_memory_fallback_enabled=True,
                swallow_errors=True,
            )
        except Exception as exc:
            logger.warning(
                "Failed to initialize Redis rate limiter storage: %s; using memory fallback",
                exc,
            )

    return SafeLimiter(
        key_func=get_client_ip,
        storage_uri="memory://",
        in_memory_fallback_enabled=True,
        swallow_errors=True,
    )


limiter = create_limiter()

