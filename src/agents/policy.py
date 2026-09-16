"""Policy Compliance subagent — RAG citations + layered program routing."""

from __future__ import annotations

import logging

from agents.program_routing import compute_program_routing
from models import (
    Applicant,
    Citation,
    SubagentName,
    SubagentOutput,
)
from subagent_state import SubagentState

logger = logging.getLogger(__name__)


def _policy_query(applicant: Applicant) -> str:
    parts = [
        f"SME loan policy for {applicant.industry} business",
        f"annual revenue {applicant.annual_revenue:.0f}",
        f"requested loan {applicant.requested_loan_amount:.0f}",
        f"{applicant.years_in_business} years in business",
        "compliance floor eligibility gate SBA 7(a) CDFI Direct SBSS",
    ]
    if applicant.sbss_proxy is not None:
        parts.append(f"SBSS score {applicant.sbss_proxy}")
    if applicant.credit_score_proxy is not None:
        parts.append(f"credit score {applicant.credit_score_proxy}")
    if applicant.requested_program is not None:
        parts.append(f"requested program {applicant.requested_program.value}")
    if applicant.lender_id:
        parts.append(f"lender {applicant.lender_id}")
    return ". ".join(parts)


def _retrieve_citations(applicant: Applicant, *, reuse: list[Citation] | None) -> list[Citation]:
    if reuse:
        return list(reuse)
    try:
        from policy_rag import citations_from_retrieval, get_policy_pipeline
        from policy_rag.filters import ensure_regulatory_citations, filter_citations

        program = (
            applicant.requested_program.value if applicant.requested_program else None
        )
        lender_id = applicant.lender_id
        fetch_k = 12 if (program or lender_id) else 5
        pipeline = get_policy_pipeline(top_k=fetch_k)
        result = pipeline.retrieve(_policy_query(applicant), top_k=fetch_k)
        pool = citations_from_retrieval(result)
        scoped = filter_citations(
            pool,
            program=program,
            lender_id=lender_id,
            include_shared_layers=True,
        )
        return ensure_regulatory_citations(scoped, pool)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Policy RAG retrieve failed (%s); continuing without citations", exc)
        return []


def run_policy_subagent(state: SubagentState) -> SubagentOutput:
    """Run one policy compliance cycle from isolated SubagentState."""
    applicant = state["applicant"]
    retry_index = state.get("retry_index", 0)
    feedback = state.get("critique_feedback")
    prior = state.get("prior_output")

    reuse: list[Citation] | None = None
    if state.get("reuse_evidence") and prior is not None and prior.citations:
        reuse = list(prior.citations)

    citations = _retrieve_citations(applicant, reuse=reuse)
    routing = compute_program_routing(applicant)

    notes = [
        f"compliance_floor={'pass' if routing.compliance_floor_pass else 'fail'}",
        f"eligibility_gate={'pass' if routing.eligibility_gate_pass else 'fail'}",
        f"eligible={','.join(p.value for p in routing.eligible_programs) or 'none'}",
        f"citations={len(citations)}",
    ]
    if applicant.lender_id:
        notes.append(f"lender={applicant.lender_id}")
    if routing.recommended_program:
        notes.append(f"recommended={routing.recommended_program.value}")
    if feedback and feedback.notes:
        notes.append(f"critic_feedback: {feedback.notes}")
    if reuse:
        notes.append("reuse_evidence=true (re-reason pass)")

    mismatch = routing.ineligible_reasons.get("lender_program_mismatch")
    if mismatch:
        return SubagentOutput(
            agent=SubagentName.POLICY,
            conclusion=f"Escalate — {mismatch}",
            confidence=0.95,
            reasoning_trace="; ".join(notes + [mismatch]),
            citations=citations,
            program_routing=routing,
            hard_reject=False,
            retry_index=retry_index,
        )

    if applicant.has_bankruptcy:
        return SubagentOutput(
            agent=SubagentName.POLICY,
            conclusion="Hard reject — bankruptcy on file",
            confidence=1.0,
            reasoning_trace="; ".join(notes + ["hard_reject:bankruptcy"]),
            citations=citations,
            program_routing=routing,
            hard_reject=True,
            hard_reject_reason="Bankruptcy on file — auto-deny per policy",
            retry_index=retry_index,
        )

    if applicant.has_severe_fraud_alert:
        return SubagentOutput(
            agent=SubagentName.POLICY,
            conclusion="Hard reject — severe fraud alert",
            confidence=1.0,
            reasoning_trace="; ".join(notes + ["hard_reject:fraud_alert"]),
            citations=citations,
            program_routing=routing,
            hard_reject=True,
            hard_reject_reason="Severe fraud alert — auto-deny per policy",
            retry_index=retry_index,
        )

    if not routing.compliance_floor_pass:
        reason = routing.ineligible_reasons.get(
            "compliance_floor", "Compliance floor violation"
        )
        return SubagentOutput(
            agent=SubagentName.POLICY,
            conclusion=f"Hard reject — {reason}",
            confidence=1.0,
            reasoning_trace="; ".join(notes + [reason]),
            citations=citations,
            program_routing=routing,
            hard_reject=True,
            hard_reject_reason=reason,
            retry_index=retry_index,
        )

    if not routing.eligibility_gate_pass:
        reason = routing.ineligible_reasons.get(
            "eligibility_gate", "Eligibility gate failure"
        )
        return SubagentOutput(
            agent=SubagentName.POLICY,
            conclusion=f"Hard reject — {reason}",
            confidence=1.0,
            reasoning_trace="; ".join(notes + [reason]),
            citations=citations,
            program_routing=routing,
            hard_reject=True,
            hard_reject_reason=reason,
            retry_index=retry_index,
        )

    if not routing.eligible_programs:
        reason = "No eligible program track (SBA 7(a) / CDFI Direct)"
        # Thin-file / borderline cases escalate instead of auto-deny.
        if applicant.metadata.get("borderline"):
            return SubagentOutput(
                agent=SubagentName.POLICY,
                conclusion="Borderline file with no eligible program — escalate",
                confidence=0.55,
                reasoning_trace="; ".join(notes + [reason, "borderline=true"]),
                citations=citations,
                program_routing=routing,
                hard_reject=False,
                retry_index=retry_index,
            )
        return SubagentOutput(
            agent=SubagentName.POLICY,
            conclusion="Deny — no eligible SBA 7(a) or CDFI Direct track",
            confidence=0.9,
            reasoning_trace="; ".join(notes + [reason]),
            citations=citations,
            program_routing=routing,
            hard_reject=True,
            hard_reject_reason=reason,
            retry_index=retry_index,
        )

    program_labels = [
        ("SBA 7(a)" if p.value == "sba_7a" else "CDFI Direct")
        for p in routing.eligible_programs
    ]
    rec = (
        routing.recommended_program.value
        if routing.recommended_program
        else "unspecified"
    )
    rec_label = (
        "SBA 7(a)"
        if rec == "sba_7a"
        else "CDFI Direct"
        if rec == "cdfi_direct"
        else rec
    )
    return SubagentOutput(
        agent=SubagentName.POLICY,
        conclusion=(
            f"Eligible for {', '.join(program_labels)}; "
            f"recommend {rec_label}"
        ),
        confidence=0.85 if citations else 0.7,
        reasoning_trace="; ".join(notes),
        citations=citations,
        program_routing=routing,
        hard_reject=False,
        retry_index=retry_index,
    )


def check_policy_compliance(applicant: Applicant, *, attempt: int = 1) -> SubagentOutput:
    """Convenience wrapper for unit tests / direct calls."""
    return run_policy_subagent(
        {
            "agent": SubagentName.POLICY,
            "applicant": applicant,
            "retry_index": max(0, attempt - 1),
            "reuse_evidence": attempt > 1,
        }
    )
