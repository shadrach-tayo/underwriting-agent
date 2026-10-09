"""CLI: ``uv run underwriting-evals``."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from evals.harness import HarnessMode
from evals.runner import braintrust_eval, run_suite
from evals.types import JudgeMode


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="underwriting-evals",
        description="Eval suite (DeepEval metrics + Braintrust dataset/evals).",
    )
    p.add_argument(
        "--mode",
        choices=["oracle", "graph", "predictions"],
        default="oracle",
        help="System under test (default: oracle — gold replay for harness smoke).",
    )
    p.add_argument(
        "--predictions",
        type=Path,
        default=None,
        help="JSONL of Prediction rows (required for --mode predictions).",
    )
    p.add_argument(
        "--gold",
        type=Path,
        default=None,
        help="Override gold set JSONL path.",
    )
    p.add_argument(
        "--judge",
        choices=["heuristic", "llm", "skip"],
        default="heuristic",
        help="Citation/RAG judge mode (llm needs API keys).",
    )
    p.add_argument("--limit", type=int, default=None, help="Max gold cases.")
    p.add_argument(
        "--sync-dataset",
        action="store_true",
        help=(
            "Upsert local gold set into the versioned Braintrust dataset "
            "(BRAINTRUST_DATASET, default underwriting-gold-set) and exit."
        ),
    )
    p.add_argument(
        "--sync-dry-run",
        action="store_true",
        help="With --sync-dataset, print record plan without calling Braintrust.",
    )
    p.add_argument(
        "--braintrust",
        action="store_true",
        help="Submit via braintrust.Eval (uses remote dataset when synced).",
    )
    p.add_argument(
        "--local-dataset",
        action="store_true",
        help="With --braintrust, feed Eval from local gold JSONL instead of remote dataset.",
    )
    p.add_argument(
        "--json-out",
        type=Path,
        default=None,
        help="Write SuiteReport JSON to this path.",
    )
    p.add_argument(
        "--fail-on-gate",
        action="store_true",
        default=True,
        help="Exit 1 if hard gate (false-approve) fails (default).",
    )
    p.add_argument(
        "--no-fail-on-gate",
        action="store_false",
        dest="fail_on_gate",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    mode: HarnessMode = args.mode
    judge: JudgeMode = args.judge

    if args.sync_dataset or args.sync_dry_run:
        from evals.braintrust_dataset import sync_gold_dataset

        summary = sync_gold_dataset(
            gold_path=args.gold,
            limit=args.limit,
            dry_run=not args.sync_dataset,
        )
        print(json.dumps(summary, indent=2))
        return 0

    report = run_suite(
        gold_path=args.gold,
        mode=mode,
        predictions_path=args.predictions,
        judge_mode=judge,
        limit=args.limit,
    )

    if args.braintrust:
        braintrust_eval(
            mode=mode,
            judge_mode=judge,
            limit=args.limit,
            use_remote_dataset=not args.local_dataset,
        )

    payload = report.model_dump(mode="json")
    summary = {
        "n_cases": report.n_cases,
        "scores": report.scores,
        "thresholds": report.thresholds,
        "passed": report.passed,
        "hard_gate_passed": report.hard_gate_passed,
        "suite_passed": report.suite_passed,
        "notes": report.notes,
    }
    print(json.dumps(summary, indent=2))

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    if args.fail_on_gate and not report.hard_gate_passed:
        print("HARD GATE FAILED: false_approve_rate > 0", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
