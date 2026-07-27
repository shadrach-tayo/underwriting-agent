"""Self Critic / Adversarial subagent — fact-check outputs; selective reruns."""

from __future__ import annotations

from underwriting_agent.models import (
    CritiqueReport,
    CritiqueVerdict,
    SubagentCritique,
    SubagentName,
    SubagentOutput,
)

# Skeleton: off by default so clean path stays fast in Studio.
FORCE_RETRY_ONCE = False


def critique_outputs(
    outputs: dict[str, SubagentOutput],
    *,
    cycle: int = 0,
    max_retries: int = 3,
) -> CritiqueReport:
    """Cross-check subagent outputs; emit PASS / RETRY / ESCALATE."""
    financial = outputs.get(SubagentName.FINANCIAL.value)
    policy = outputs.get(SubagentName.POLICY.value)
    per_agent: list[SubagentCritique] = []
    rerun: list[SubagentName] = []
    notes: list[str] = []

    if financial is None:
        per_agent.append(
            SubagentCritique(
                agent=SubagentName.FINANCIAL,
                passed=False,
                deficiencies=["missing_financial_output"],
            )
        )
        rerun.append(SubagentName.FINANCIAL)
        notes.append("missing financial output")
    else:
        deficiencies: list[str] = []
        if not financial.reasoning_trace:
            deficiencies.append("empty_reasoning_trace")
        if financial.metrics is None:
            deficiencies.append("missing_metrics")
        passed = not deficiencies
        per_agent.append(
            SubagentCritique(
                agent=SubagentName.FINANCIAL,
                passed=passed,
                deficiencies=deficiencies,
            )
        )
        if not passed:
            rerun.append(SubagentName.FINANCIAL)
        notes.append(financial.conclusion)

    if policy is None:
        per_agent.append(
            SubagentCritique(
                agent=SubagentName.POLICY,
                passed=False,
                deficiencies=["missing_policy_output"],
            )
        )
        rerun.append(SubagentName.POLICY)
        notes.append("missing policy output")
    else:
        deficiencies = []
        grounding_failures: list[str] = []
        if not policy.citations:
            deficiencies.append("missing_citations")
        else:
            for cite in policy.citations:
                # Stub: treat missing grounding as not-yet-verified (pass for now).
                if cite.grounded is False:
                    grounding_failures.append(cite.clause_id)
                    deficiencies.append(f"ungrounded:{cite.clause_id}")
        unresolved = [c.clause_a.clause_id for c in policy.conflicts if not c.resolved]
        passed = not deficiencies
        per_agent.append(
            SubagentCritique(
                agent=SubagentName.POLICY,
                passed=passed,
                citation_grounding_failures=grounding_failures,
                unacknowledged_conflicts=unresolved,
                deficiencies=deficiencies,
            )
        )
        if not passed:
            rerun.append(SubagentName.POLICY)
        notes.append(policy.conclusion)

    if FORCE_RETRY_ONCE and cycle == 0 and not rerun:
        rerun.append(SubagentName.FINANCIAL)
        notes.append("adversarial_pass_requested")
        for item in per_agent:
            if item.agent == SubagentName.FINANCIAL:
                item.passed = False
                item.deficiencies.append("adversarial_pass")

    # Deduplicate while preserving order
    seen: set[SubagentName] = set()
    unique_rerun: list[SubagentName] = []
    for t in rerun:
        if t not in seen:
            seen.add(t)
            unique_rerun.append(t)

    if unique_rerun:
        if cycle >= max_retries:
            verdict = CritiqueVerdict.ESCALATE
            unique_rerun = []
            notes.append("retries exhausted → escalate")
        else:
            verdict = CritiqueVerdict.RETRY
    else:
        verdict = CritiqueVerdict.PASS

    return CritiqueReport(
        verdict=verdict,
        per_agent=per_agent,
        rerun_targets=unique_rerun,
        critic_confidence=0.7 if verdict == CritiqueVerdict.ESCALATE else 0.9,
        notes="; ".join(notes),
        cycle=cycle,
    )


# Backward-compatible name
critique_reports = critique_outputs
