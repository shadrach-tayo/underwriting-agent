"""System-under-test adapters: oracle, offline predictions JSONL, live graph."""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from evals.gold_set import GoldCase
from evals.tracing import span
from evals.types import Prediction, decision_from_gold_label
from models import Citation, Decision, PolicyLayer, PolicySource

HarnessMode = Literal["oracle", "graph", "predictions"]

PredictFn = Callable[[GoldCase], Prediction]


def _placeholder_citation(case: GoldCase) -> Citation:
    """Minimal citation so citation metrics exercise non-empty paths for oracle."""
    refs = case.label.policy_refs or ["eligibility_gate"]
    text = (
        f"Policy layer {refs[0]} supports outcome "
        f"{case.label.outcome.value} for {case.applicant.business_name}. "
        f"{case.label.rationale}"
    )
    return Citation(
        clause_id=f"{case.case_id}:{refs[0]}",
        source=PolicySource(
            source_id=refs[0],
            name=refs[0],
            authority="lender",
            version="gold-oracle",
            effective_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
            program=PolicyLayer.ELIGIBILITY_GATE,
        ),
        retrieved_text=text,
        similarity_score=1.0,
        program=PolicyLayer.ELIGIBILITY_GATE,
    )


def predict_oracle(case: GoldCase) -> Prediction:
    """Replay gold labels as predictions — validates the eval harness itself."""
    cite = _placeholder_citation(case)
    decision = decision_from_gold_label(
        outcome=case.label.outcome,
        risk_tier=case.label.risk_tier,
        rationale=case.label.rationale,
        eligible_programs=list(case.label.eligible_programs),
        recommended_program=case.label.recommended_program,
        compliance_floor_pass=case.label.compliance_floor_pass,
        eligibility_gate_pass=case.label.eligibility_gate_pass,
        citations=[cite],
    )
    ref_ctx = [cite.retrieved_text]
    return Prediction(
        case_id=case.case_id,
        decision=decision,
        retrieved_contexts=ref_ctx,
        reference_contexts=ref_ctx,
        latency_ms=0.0,
        metadata={"harness": "oracle"},
    )


def predict_graph(case: GoldCase) -> Prediction:
    """Invoke the compiled LangGraph agent on one gold applicant."""
    from graph.runtime import decision_from_state, run_underwrite

    t0 = time.perf_counter()
    with span("eval.graph_invoke", span_attributes={"type": "task"}) as current:
        if current is not None:
            current.log(input={"case_id": case.case_id})
        result: dict[str, Any] = run_underwrite(
            case.applicant,
            case_id=case.case_id,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        decision = decision_from_state(result)

        retrieved: list[str] = []
        outputs = result.get("subagent_outputs") or {}
        for out in outputs.values():
            cites = getattr(out, "citations", None) or []
            for c in cites:
                text = getattr(c, "retrieved_text", None)
                if text:
                    retrieved.append(text)

        pred = Prediction(
            case_id=case.case_id,
            decision=decision,
            retrieved_contexts=retrieved,
            reference_contexts=[],
            latency_ms=elapsed_ms,
            metadata={"harness": "graph"},
        )
        if current is not None:
            current.log(output=pred.model_dump(mode="json"))
        return pred


def load_predictions_jsonl(path: Path) -> dict[str, Prediction]:
    by_id: dict[str, Prediction] = {}
    with path.open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, start=1):
            text = line.strip()
            if not text or text.startswith("#"):
                continue
            try:
                pred = Prediction.model_validate_json(text)
            except Exception as exc:  # noqa: BLE001
                raise ValueError(f"Invalid prediction at {path}:{line_no}: {exc}") from exc
            by_id[pred.case_id] = pred
    return by_id


def make_predictions_harness(path: Path) -> PredictFn:
    loaded = load_predictions_jsonl(path)

    def _predict(case: GoldCase) -> Prediction:
        if case.case_id not in loaded:
            raise KeyError(f"No prediction for case_id={case.case_id} in {path}")
        return loaded[case.case_id]

    return _predict


def resolve_predict_fn(
    mode: HarnessMode,
    *,
    predictions_path: Path | None = None,
) -> PredictFn:
    if mode == "oracle":
        return predict_oracle
    if mode == "graph":
        return predict_graph
    if mode == "predictions":
        if predictions_path is None:
            raise ValueError("--predictions path required for mode=predictions")
        return make_predictions_harness(predictions_path)
    raise ValueError(f"Unknown harness mode: {mode}")


def dump_predictions(path: Path, preds: list[Prediction]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for pred in preds:
            fh.write(json.dumps(pred.model_dump(mode="json"), ensure_ascii=False) + "\n")
