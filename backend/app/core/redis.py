import logging
import os
import socket
import time
import redis

logger = logging.getLogger(__name__)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

# Normalize host to 127.0.0.1 if localhost to avoid Windows IPv6 resolution delay
_RESOLVED_HOST = "127.0.0.1" if REDIS_HOST.lower() in ("localhost", "127.0.0.1") else REDIS_HOST

redis_client = redis.Redis(
    host=_RESOLVED_HOST,
    port=REDIS_PORT,
    decode_responses=True,
    socket_timeout=0.5,
    socket_connect_timeout=0.5,
)

_last_probe_time = 0.0
_cached_availability = False


def is_redis_available(cache_seconds: float = 3.0) -> bool:
    """
    Check whether the Redis server is reachable via a fast, non-blocking socket probe.
    Caches the result for cache_seconds to ensure zero latency on repeated calls.
    """
    global _last_probe_time, _cached_availability
    now = time.monotonic()
    if now - _last_probe_time < cache_seconds:
        return _cached_availability

    _last_probe_time = now
    try:
        with socket.create_connection((_RESOLVED_HOST, REDIS_PORT), timeout=0.15):
            _cached_availability = True
    except (OSError, socket.timeout):
        _cached_availability = False

    return _cached_availability


def check_transaction_velocity(account_id: str, window_seconds: int = 60) -> int:
    """
    Counts and increments recent transaction velocity for account_id within a sliding time window.
    Falls back immediately to 1 if Redis is unavailable.
    """
    if not is_redis_available():
        return 1

    try:
        key = f"velocity:account:{account_id}"
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        result = pipe.execute()
        return int(result[0])
    except Exception as exc:
        logger.warning(f"Redis velocity check bypassed: {exc}")
        return 1