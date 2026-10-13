from collections import deque
from threading import Lock
from time import monotonic

_MAX_SAMPLES = 1000
_SAMPLE_WINDOW_SECONDS = 300
_api_samples: deque[tuple[float, float]] = deque(maxlen=_MAX_SAMPLES)
_inference_samples: deque[tuple[float, float]] = deque(maxlen=_MAX_SAMPLES)
_samples_lock = Lock()


def record_api_latency(latency_ms: float) -> None:
    with _samples_lock:
        _api_samples.append((monotonic(), latency_ms))


def record_inference_latency(latency_ms: float) -> None:
    with _samples_lock:
        _inference_samples.append((monotonic(), latency_ms))


def _percentile_95(samples: deque[tuple[float, float]]) -> float | None:
    cutoff = monotonic() - _SAMPLE_WINDOW_SECONDS
    values = sorted(value for timestamp, value in samples if timestamp >= cutoff)
    if not values:
        return None
    index = max(0, int(0.95 * len(values) + 0.999999) - 1)
    return round(values[index], 2)


def get_latency_metrics() -> dict[str, float | int | None]:
    with _samples_lock:
        return {
            "api_p95_ms": _percentile_95(_api_samples),
            "api_sample_count": sum(
                1
                for timestamp, _ in _api_samples
                if timestamp >= monotonic() - _SAMPLE_WINDOW_SECONDS
            ),
            "inference_p95_ms": _percentile_95(_inference_samples),
            "inference_sample_count": sum(
                1
                for timestamp, _ in _inference_samples
                if timestamp >= monotonic() - _SAMPLE_WINDOW_SECONDS
            ),
        }
