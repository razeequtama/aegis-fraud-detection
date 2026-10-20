import pytest
from unittest.mock import MagicMock, patch

from app.services.observability import (
    get_latency_metrics,
    record_api_latency,
    record_inference_latency,
    _percentile_95,
)


def test_observability_process_local_fallback():
    """
    ARCH-01 Verification:
    When Redis is unavailable, observability seamlessly records to thread-safe
    local deques and calculates accurate P95 latency and sample counts.
    """
    with patch("app.services.observability._record_to_redis", return_value=False), \
         patch("app.services.observability._get_metrics_from_redis", return_value=None):
        
        # Record sample API and inference latencies
        record_api_latency(15.2)
        record_api_latency(28.4)
        record_api_latency(120.0)

        record_inference_latency(4.5)
        record_inference_latency(8.2)

        metrics = get_latency_metrics()

        assert metrics["api_sample_count"] >= 3
        assert metrics["api_p95_ms"] is not None
        assert metrics["api_p95_ms"] >= 15.2

        assert metrics["inference_sample_count"] >= 2
        assert metrics["inference_p95_ms"] is not None
        assert metrics["inference_p95_ms"] >= 4.5


def test_observability_redis_cross_worker_aggregation():
    """
    ARCH-01 Verification:
    When Redis is available, latency metrics aggregate across all 4 Uvicorn workers
    using Redis sorted sets with timestamp scores.
    """
    mock_redis = MagicMock()
    mock_pipe = MagicMock()
    mock_redis.pipeline.return_value = mock_pipe

    # Simulate 5 concurrent request samples gathered across different worker processes:
    # 10.0ms, 15.0ms, 20.0ms, 25.0ms, 100.0ms
    simulated_members = [
        "10.0:worker1_a",
        "15.0:worker2_b",
        "20.0:worker3_c",
        "25.0:worker4_d",
        "100.0:worker1_e",
    ]
    mock_redis.zrangebyscore.return_value = simulated_members

    with patch("app.core.redis.is_redis_available", return_value=True), \
         patch("app.core.redis.redis_client", mock_redis):

        # Record a latency event
        record_api_latency(35.5)

        # Verify pipeline added member with zadd and pruned expired samples
        assert mock_pipe.zadd.called
        assert mock_pipe.zremrangebyscore.called
        assert mock_pipe.execute.called

        # Query metrics
        metrics = get_latency_metrics()

        # Both workers' aggregated samples are returned (5 samples, P95 = 100.0)
        assert metrics["api_sample_count"] == 5
        assert metrics["api_p95_ms"] == 100.0


def test_observability_percentile_computation():
    """Validates the P95 mathematical computation."""
    from collections import deque
    from time import monotonic

    now = monotonic()
    empty_samples: deque = deque()
    assert _percentile_95(empty_samples) is None

    single_sample: deque = deque([(now, 42.0)])
    assert _percentile_95(single_sample) == 42.0

    # 100 samples from 1ms to 100ms
    hundred_samples: deque = deque([(now, float(i)) for i in range(1, 101)])
    p95 = _percentile_95(hundred_samples)
    assert p95 == 95.0

