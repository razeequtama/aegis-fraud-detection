import logging
import os
import socket
import time
import redis

logger = logging.getLogger(__name__)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None

# Normalize host to 127.0.0.1 if localhost to avoid Windows IPv6 resolution delay
_RESOLVED_HOST = "127.0.0.1" if REDIS_HOST.lower() in ("localhost", "127.0.0.1") else REDIS_HOST

redis_client = redis.Redis(
    host=_RESOLVED_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    decode_responses=True,
    socket_timeout=0.5,
    socket_connect_timeout=0.5,
)

_last_probe_time = 0.0
_cached_availability = False


def is_redis_available(cache_seconds: float = 3.0) -> bool:
    """
    Check whether the Redis server is reachable and authenticated.
    Caches the result for cache_seconds to ensure zero latency on repeated calls.
    In testing environments without explicit opt-in, short-circuits immediately to prevent socket timeouts.
    """
    if os.getenv("TESTING") == "1" and os.getenv("ENABLE_TEST_REDIS", "").lower() not in ("1", "true"):
        return False

    global _last_probe_time, _cached_availability
    now = time.monotonic()
    if now - _last_probe_time < cache_seconds:
        return _cached_availability

    _last_probe_time = now
    try:
        _cached_availability = bool(redis_client.ping())
    except (redis.RedisError, OSError, socket.timeout):
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


_last_reset_time = 0.0


def acquire_demo_reset_lock(cooldown_seconds: int = 600) -> tuple[bool, int]:
    """
    Acquires an atomic distributed lock for resetting demo state.
    Returns (allowed: bool, remaining_cooldown_seconds: int).
    Enforces a global cooldown to prevent concurrent or repetitive database resets.
    """
    global _last_reset_time
    if is_redis_available():
        try:
            lock_key = "aegis:system:reset_demo:cooldown"
            # SET NX EX: atomically sets only if key doesn't exist, expiring in cooldown_seconds
            acquired = redis_client.set(lock_key, "1", ex=cooldown_seconds, nx=True)
            if acquired:
                return True, 0
            ttl = redis_client.ttl(lock_key)
            return False, max(1, int(ttl))
        except Exception as exc:
            logger.warning(f"Redis reset lock failed, falling back to local memory: {exc}")

    now = time.monotonic()
    elapsed = now - _last_reset_time
    if _last_reset_time > 0 and elapsed < cooldown_seconds:
        remaining = int(cooldown_seconds - elapsed)
        return False, max(1, remaining)

    _last_reset_time = now
    return True, 0


def clear_demo_reset_lock() -> None:
    """Clears the reset cooldown lock (primarily used for test cleanup)."""
    global _last_reset_time
    _last_reset_time = 0.0
    if is_redis_available():
        try:
            redis_client.delete("aegis:system:reset_demo:cooldown")
        except Exception:
            pass
