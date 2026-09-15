"""Braintrust tracing for backend + LangGraph eval / runtime spans."""

from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from contextlib import contextmanager, nullcontext
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

_PROJECT_DEFAULT = "underwriting-agent"


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


@lru_cache
def braintrust_enabled() -> bool:
    """Require an explicit opt-in so a bad ``.env`` key cannot break local runs."""
    if not _truthy(os.getenv("BRAINTRUST_TRACING")):
        return False
    return bool((os.getenv("BRAINTRUST_API_KEY") or "").strip())


def project_name() -> str:
    return (os.getenv("BRAINTRUST_PROJECT") or _PROJECT_DEFAULT).strip()


@lru_cache
def init_tracing(*, project: str | None = None) -> Any | None:
    """Initialize Braintrust logger when tracing is opted in.

    Safe no-op unless ``BRAINTRUST_TRACING=true`` and ``BRAINTRUST_API_KEY`` is set.
    Soft-fails on invalid keys.
    """
    if not braintrust_enabled():
        return None
    try:
        from braintrust import init_logger
    except ImportError:  # pragma: no cover
        logger.warning("braintrust package not installed")
        return None
    try:
        return init_logger(project=project or project_name())
    except Exception as exc:  # noqa: BLE001
        logger.warning("Braintrust init failed (%s); continuing without tracing", exc)
        return None


@contextmanager
def span(name: str, **kwargs: Any) -> Iterator[Any]:
    """Open a Braintrust span when tracing is active; otherwise a null context."""
    bt_logger = init_tracing()
    if bt_logger is None:
        yield None
        return
    cm = bt_logger.start_span(name=name, **kwargs)
    with cm as current:
        yield current


def traced(name: str | None = None):
    """Decorator: wrap a function in a Braintrust span when enabled."""

    def decorator(fn):
        span_name = name or fn.__qualname__

        def wrapper(*args, **kwargs):
            with span(span_name) as current:
                result = fn(*args, **kwargs)
                if current is not None:
                    try:
                        current.log(output=_safe_log_value(result))
                    except Exception:  # noqa: BLE001
                        pass
                return result

        wrapper.__name__ = fn.__name__
        wrapper.__doc__ = fn.__doc__
        return wrapper

    return decorator


def _safe_log_value(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, (str, int, float, bool, type(None), dict, list)):
        return value
    return str(value)
