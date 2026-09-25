"""Cross-cutting HTTP middleware — request IDs and Prometheus HTTP metrics."""

from __future__ import annotations

import time
from collections.abc import Callable
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from http_api.prometheus import observe_http

_SKIP_HTTP_METRICS = frozenset({"/prometheus", "/health", "/ready"})


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Honor inbound ``X-Request-ID`` or mint one; echo it on the response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id") or uuid4().hex
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class PrometheusHttpMiddleware(BaseHTTPMiddleware):
    """Count request rate and latency. Skips scrape/health to keep cardinality clean."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path in _SKIP_HTTP_METRICS:
            return await call_next(request)
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            observe_http(
                request.method,
                path,
                status,
                time.perf_counter() - start,
            )
