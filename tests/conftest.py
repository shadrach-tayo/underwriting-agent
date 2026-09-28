"""Ensure a gold set exists for tests that load applicants.jsonl."""

from __future__ import annotations

from evals.generate_gold_set import write_gold_set
from evals.gold_set import GOLD_SET_PATH
from policy_rag import policy_sources_dir


def pytest_sessionstart(session: object) -> None:  # noqa: ARG001
    if not GOLD_SET_PATH.is_file():
        write_gold_set()
    policy_sources_dir().mkdir(parents=True, exist_ok=True)
