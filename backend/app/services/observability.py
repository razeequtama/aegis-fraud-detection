from collections import deque
from threading import Lock
from time import monotonic, time
import uuid
from typing import Dict, Optional, Tuple, Union

_MAX_SAMPLES = 1000
_SAMPLE_WINDOW_SECONDS = 300
_api_samples: deque[Tuple[float, float]] = deque(maxlen=_MAX_SAMPLES)
_inference_samples: deque[Tuple[float, float]] = deque(maxlen=_MAX_SAMPLES)
_samples_lock = Lock()

REDIS_API_LATENCY_KEY = "aegis:observability:latency:api"
REDIS_INFERENCE_LATENCY_KEY = "aegis:observability:latency:inference"


def _record_to_redis(key: str, latency_ms: float) -> bool:
    try:
        from app.core.redis import is_redis_available, redis_client
        if is_redis_available():
            now = time()
            member = f"{round(latency_ms, 3)}:{uuid.uuid4().hex[:8]}"
            pipe = redis_client.pipeline()
            pipe.zadd(key, {member: now})
            pipe.zremrangebyscore(key, "-inf", now - _SAMPLE_WINDOW_SECONDS)
            pipe.expire(key, _SAMPLE_WINDOW_SECONDS * 2)
            pipe.execute()
            return True
    except Exception:
        pass
    return False


def _get_metrics_from_redis(key: str) -> Optional[Tuple[Optional[float], int]]:
    try:
        from app.core.redis import is_redis_available, redis_client
        if is_redis_available():
            now = time()
            cutoff = now - _SAMPLE_WINDOW_SECONDS
            redis_client.zremrangebyscore(key, "-inf", cutoff)
            members = redis_client.zrangebyscore(key, cutoff, "+inf")
            if not members:
                return (None, 0)
            values = sorted(float(m.split(":")[0]) for m in members if ":" in m)
            if not values:
                return (None, 0)
            index = max(0, int(0.95 * len(values) + 0.999999) - 1)
            p95 = round(values[index], 2)
            return (p95, len(values))
    except Exception:
        pass
    return None


def record_api_latency(latency_ms: float) -> None:
    # Always record to in-memory deque as worker-local fallback
    with _samples_lock:
        _api_samples.append((monotonic(), latency_ms))
    # Aggregate across Uvicorn workers when Redis is reachable
    _record_to_redis(REDIS_API_LATENCY_KEY, latency_ms)


def record_inference_latency(latency_ms: float) -> None:
    # Always record to in-memory deque as worker-local fallback
    with _samples_lock:
        _inference_samples.append((monotonic(), latency_ms))
    # Aggregate across Uvicorn workers when Redis is reachable
    _record_to_redis(REDIS_INFERENCE_LATENCY_KEY, latency_ms)


def _percentile_95(samples: deque[Tuple[float, float]]) -> Optional[float]:
    cutoff = monotonic() - _SAMPLE_WINDOW_SECONDS
    values = sorted(value for timestamp, value in samples if timestamp >= cutoff)
    if not values:
        return None
    index = max(0, int(0.95 * len(values) + 0.999999) - 1)
    return round(values[index], 2)


def get_latency_metrics() -> Dict[str, Union[float, int, None]]:
    # Check if cross-process Redis metrics are available
    redis_api = _get_metrics_from_redis(REDIS_API_LATENCY_KEY)
    redis_inf = _get_metrics_from_redis(REDIS_INFERENCE_LATENCY_KEY)

    with _samples_lock:
        if redis_api is not None:
            api_p95, api_count = redis_api
        else:
            api_p95 = _percentile_95(_api_samples)
            api_count = sum(
                1 for timestamp, _ in _api_samples if timestamp >= monotonic() - _SAMPLE_WINDOW_SECONDS
            )

        if redis_inf is not None:
            inf_p95, inf_count = redis_inf
        else:
            inf_p95 = _percentile_95(_inference_samples)
            inf_count = sum(
                1 for timestamp, _ in _inference_samples if timestamp >= monotonic() - _SAMPLE_WINDOW_SECONDS
            )

        return {
            "api_p95_ms": api_p95,
            "api_sample_count": api_count,
            "inference_p95_ms": inf_p95,
            "inference_sample_count": inf_count,
        }
