"""In-process underwrite metrics."""

from __future__ import annotations

import threading
from collections import Counter, deque
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from statistics import quantiles
from typing import Any

from http_api.prometheus import observe_underwrite


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    # statistics.quantiles n=100 → 99 cut points; index p-1 ≈ percentile p
    cuts = quantiles(values, n=100, method="inclusive")
    idx = max(0, min(98, int(p) - 1))
    return cuts[idx]


@dataclass
class UnderwriteMetrics:
    """Process-local counters; fine for single-replica local/demo deploys."""

    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _day: date = field(default_factory=_utc_today)
    _outcomes: Counter[str] = field(default_factory=Counter)
    _latencies_ms: deque[float] = field(default_factory=lambda: deque(maxlen=2_000))
    _errors: int = 0

    def _roll_day_locked(self) -> None:
        today = _utc_today()
        if today != self._day:
            self._day = today
            self._outcomes = Counter()
            self._errors = 0
            # Keep latency window across day boundary for p50/p95 stability.

    def record(
        self,
        *,
        outcome: str,
        latency_ms: float,
        error: bool = False,
    ) -> None:
        with self._lock:
            self._roll_day_locked()
            if error:
                self._errors += 1
            else:
                self._outcomes[outcome] += 1
                self._latencies_ms.append(float(latency_ms))
        observe_underwrite(
            outcome=outcome, latency_ms=latency_ms, error=error
        )

    def reset(self) -> None:
        with self._lock:
            self._day = _utc_today()
            self._outcomes = Counter()
            self._latencies_ms.clear()
            self._errors = 0

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._roll_day_locked()
            outcomes = dict(self._outcomes)
            latencies = list(self._latencies_ms)
            errors = self._errors
            day = self._day.isoformat()

        total = sum(outcomes.values())
        escalations = outcomes.get("escalate", 0)
        escalation_rate = (escalations / total) if total else None
        return {
            "day_utc": day,
            "decisions_today": total,
            "outcomes": {
                "approve": outcomes.get("approve", 0),
                "deny": outcomes.get("deny", 0),
                "escalate": escalations,
            },
            "escalation_rate": escalation_rate,
            "errors_today": errors,
            "latency_ms": {
                "count": len(latencies),
                "p50": _percentile(latencies, 50),
                "p95": _percentile(latencies, 95),
            },
        }


METRICS = UnderwriteMetrics()
