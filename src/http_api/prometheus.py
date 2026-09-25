"""Prometheus registry for HTTP + underwrite domain metrics.

``GET /metrics`` stays JSON for the Admin card. Scrapes use ``GET /prometheus``.
"""

from __future__ import annotations

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
)

REGISTRY = CollectorRegistry()

http_requests_total = Counter(
    "http_requests_total",
    "HTTP requests",
    ["method", "endpoint", "status"],
    registry=REGISTRY,
)
http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 15.0),
    registry=REGISTRY,
)
underwrite_decisions_total = Counter(
    "underwrite_decisions_total",
    "Underwrite decisions by outcome",
    ["outcome"],
    registry=REGISTRY,
)
underwrite_errors_total = Counter(
    "underwrite_errors_total",
    "Underwrite handler errors (502 / missing decision)",
    registry=REGISTRY,
)
underwrite_latency_seconds = Histogram(
    "underwrite_latency_seconds",
    "LangGraph underwrite latency in seconds",
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 15.0),
    registry=REGISTRY,
)

PROMETHEUS_CONTENT_TYPE = CONTENT_TYPE_LATEST


def render_prometheus() -> bytes:
    return generate_latest(REGISTRY)


def observe_http(method: str, endpoint: str, status: int, duration_s: float) -> None:
    http_requests_total.labels(
        method=method, endpoint=endpoint, status=str(status)
    ).inc()
    http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(
        duration_s
    )


def observe_underwrite(*, outcome: str, latency_ms: float, error: bool) -> None:
    underwrite_latency_seconds.observe(max(latency_ms, 0.0) / 1000.0)
    if error:
        underwrite_errors_total.inc()
        return
    underwrite_decisions_total.labels(outcome=outcome).inc()
