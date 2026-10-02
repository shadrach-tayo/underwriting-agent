"""Provider error taxonomy + optional backoff for non-SDK call sites.

Provider HTTP (Voyage / DeepSeek / ChatOpenAI) is retried by the SDK.
This module does **not** stack another loop on those calls. After the SDK
gives up, fail closed. Fatal errors (quota, auth) never retry.
"""

from __future__ import annotations

import logging
import os
import random
import time
from collections.abc import Callable

from config import get_settings

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = frozenset({408, 409, 425, 429, 500, 502, 503, 504})
FATAL_STATUS_CODES = frozenset({400, 401, 403, 404})
_RETRYABLE_MARKERS = (
    "rate limit",
    "too many requests",
    "timeout",
    "timed out",
    "temporarily unavailable",
    "connection reset",
    "connection aborted",
    "service unavailable",
    "econnreset",
    "econnrefused",
)
_FATAL_MARKERS = (
    "insufficient_quota",
    "insufficient_funds",
    "credit_balance",
    "credits remaining",
    "no credits",
    "billing hard limit",
    "invalid_api_key",
    "invalid api key",
    "incorrect api key",
    "authentication",
    "unauthorized",
    "permission denied",
    "forbidden",
)


class RetryableProviderError(Exception):
    """Transient Voyage / DeepSeek / HTTP failure."""


class ProviderOutageError(RetryableProviderError):
    """Provider call failed after the SDK (or a non-SDK helper) gave up."""


DATABASE_UNAVAILABLE_MESSAGE = (
    "Policy database is unreachable. Check that Postgres is running, then retry."
)

_DB_ERROR_NAMES = frozenset(
    {
        "OperationalError",
        "InterfaceError",
        "CannotConnectNow",
        "ConnectionTimeout",
        "AdminShutdown",
    }
)
_DB_MODULES = ("psycopg", "sqlalchemy", "asyncpg", "pg8000")


class DatabaseUnavailableError(Exception):
    """Postgres could not be reached. The message is safe to show to users."""

    def __init__(self, message: str = DATABASE_UNAVAILABLE_MESSAGE) -> None:
        super().__init__(message)


def database_outage_text(text: str) -> bool:
    """True when a string is a driver dump from a failed Postgres connection."""
    lowered = text.lower()
    if "sqlalche.me/e/20/e3q8" in lowered:
        return True
    if "could not connect to server" in lowered:
        return True
    if "the database system is starting up" in lowered:
        return True
    if "the database system is shutting down" in lowered:
        return True
    return "connection to server at" in lowered and (
        "connection refused" in lowered or "connection failed" in lowered
    )


def is_database_unavailable(exc: BaseException) -> bool:
    """True for Postgres connect failures, not generic HTTP/provider errors."""
    if isinstance(exc, DatabaseUnavailableError):
        return True
    for item in _walk_exceptions(exc):
        module = type(item).__module__.lower()
        if type(item).__name__ in _DB_ERROR_NAMES and any(
            token in module for token in _DB_MODULES
        ):
            return True
        if database_outage_text(str(item)):
            return True
    return False


def _under_pytest() -> bool:
    return bool(os.environ.get("PYTEST_CURRENT_TEST"))


def _status_code(exc: BaseException) -> int | None:
    for attr in ("status_code", "status"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(exc, "response", None)
    if response is not None:
        code = getattr(response, "status_code", None)
        if isinstance(code, int):
            return code
    return None


def _walk_exceptions(exc: BaseException) -> list[BaseException]:
    seen: set[int] = set()
    stack: list[BaseException] = [exc]
    out: list[BaseException] = []
    while stack:
        current = stack.pop()
        marker = id(current)
        if marker in seen:
            continue
        seen.add(marker)
        out.append(current)
        if current.__cause__ is not None:
            stack.append(current.__cause__)
        if current.__context__ is not None:
            stack.append(current.__context__)
    return out


def is_fatal_provider_error(exc: BaseException) -> bool:
    """Quota, auth, and other errors that must not be retried."""
    for item in _walk_exceptions(exc):
        code = _status_code(item)
        if code in FATAL_STATUS_CODES:
            return True
        text = str(item).lower()
        if any(marker in text for marker in _FATAL_MARKERS):
            return True
    return False


def is_retryable(exc: BaseException) -> bool:
    """True only for transient failures. Fatal quota/auth errors are never retried."""
    if isinstance(exc, ProviderOutageError) or is_fatal_provider_error(exc):
        return False
    try:
        import httpx
    except ImportError:  # pragma: no cover
        httpx = None  # type: ignore[assignment]
    try:
        import requests
    except ImportError:  # pragma: no cover
        requests = None  # type: ignore[assignment]

    for item in _walk_exceptions(exc):
        if isinstance(item, RetryableProviderError) and not isinstance(
            item, ProviderOutageError
        ):
            return True
        if isinstance(item, (ConnectionError, TimeoutError)):
            return True
        if httpx is not None and isinstance(item, httpx.TransportError):
            return True
        if httpx is not None and isinstance(item, httpx.HTTPStatusError):
            code = _status_code(item)
            if code in RETRYABLE_STATUS_CODES:
                return True
            continue
        if requests is not None and isinstance(
            item, (requests.ConnectionError, requests.Timeout)
        ):
            return True
        if requests is not None and isinstance(item, requests.HTTPError):
            code = _status_code(item)
            if code in RETRYABLE_STATUS_CODES:
                return True
            continue
        code = _status_code(item)
        if code in RETRYABLE_STATUS_CODES:
            return True
        text = str(item).lower()
        if any(marker in text for marker in _RETRYABLE_MARKERS):
            return True
    return False


def should_retry_node(exc: BaseException) -> bool:
    """LangGraph node safety net — never re-run after a provider/SDK failure."""
    if is_fatal_provider_error(exc) or isinstance(exc, ProviderOutageError):
        return False
    if isinstance(exc, RetryableProviderError):
        return False
    return False


def classify_provider_error(exc: Exception) -> Exception:
    """Tag retryable transport failures; leave fatal / logic errors untouched."""
    if isinstance(exc, (RetryableProviderError, ProviderOutageError)):
        return exc
    if is_fatal_provider_error(exc):
        return exc
    if is_retryable(exc):
        return RetryableProviderError(str(exc) or exc.__class__.__name__)
    return exc


def retry_delay(attempt: int) -> float:
    """Sleep seconds before retry ``attempt`` (1-based, after a failure)."""
    settings = get_settings()
    if _under_pytest():
        return 0.0
    base = settings.provider_retry_initial_interval * (
        settings.provider_retry_backoff_factor ** max(0, attempt - 1)
    )
    capped = min(base, settings.provider_retry_max_interval)
    if capped <= 0:
        return 0.0
    jitter = random.uniform(0.0, capped * 0.1)
    return capped + jitter


def call_with_retry[T](
    fn: Callable[[], T],
    *,
    operation: str = "provider_call",
    attempts: int | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> T:
    """Conditional backoff for **non-SDK** call sites.

    Do not wrap Voyage / ChatOpenAI / DeepSeek — those already retry. Fatal
    errors (quota, auth) stop on the first attempt.
    """
    settings = get_settings()
    max_attempts = attempts if attempts is not None else settings.provider_retry_attempts
    last: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last = exc
            retryable = is_retryable(exc)
            if not retryable or attempt >= max_attempts:
                if retryable:
                    raise ProviderOutageError(
                        f"{operation} failed after {attempt} attempts: {exc}"
                    ) from exc
                raise
            delay = retry_delay(attempt)
            logger.warning(
                "%s failed (attempt %s/%s); retrying in %.2fs: %s",
                operation,
                attempt,
                max_attempts,
                delay,
                exc,
            )
            if delay > 0:
                sleep(delay)
    assert last is not None
    raise ProviderOutageError(f"{operation} failed: {last}") from last
