"""State value objects for the underwriting decision & escalation agent.

Graph channel state lives in `graph.state`; these Pydantic models validate and
serialize cleanly into the audit trail.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Annotated, Any, Literal, Optional

from pydantic import BaseModel, BeforeValidator, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SubagentName(StrEnum):
    FINANCIAL = "financial_analysis"
    POLICY = "policy_compliance"


class DecisionOutcome(StrEnum):
    APPROVE = "approve"
    DENY = "deny"
    ESCALATE = "escalate"


class DecisionOrigin(StrEnum):
    AUTO = "auto"
    HUMAN = "human"
    HUMAN_OVERRIDE = "human_override"


class CritiqueVerdict(StrEnum):
    PASS = "pass"
    RETRY = "retry"
    ESCALATE = "escalate"


class RiskTier(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    PROHIBITED = "prohibited"


class PolicyLayer(StrEnum):
    """Three policy layers — never flatten into one scored rule set.

    Chunk metadata uses the same string values under the ``program`` key.
    """

    COMPLIANCE_FLOOR = "compliance_floor"  # ECOA/Reg B — boolean gate every decision
    ELIGIBILITY_GATE = "eligibility_gate"  # SBA core eligibility as universal min bar
    SBA_7A = "sba_7a"  # SBA 7(a) program underwriting
    CDFI_DIRECT = "cdfi_direct"  # Accion-style direct CDFI product


class LoanProgram(StrEnum):
    """Originate-able product types (not lender-specific overlays)."""

    SBA_7A = "sba_7a"
    CDFI_DIRECT = "cdfi_direct"


# ---------------------------------------------------------------------------
# Leaf value objects
# ---------------------------------------------------------------------------


class Applicant(BaseModel):
    """Structured SME loan applicant profile (synthetic / non-PII)."""

    applicant_id: str
    business_name: str
    industry: str
    annual_revenue: float = Field(ge=0)
    requested_loan_amount: float = Field(gt=0)
    years_in_business: float = Field(ge=0)
    debt_service_coverage_ratio: float | None = None
    credit_score_proxy: int | None = Field(default=None, ge=300, le=850)
    # Soft FICO SBSS proxy for SBA track (gold-set label / routing); optional.
    sbss_proxy: int | None = Field(default=None, ge=0, le=300)
    has_bankruptcy: bool = False
    has_severe_fraud_alert: bool = False
    # Preferred product if stated; agent may still recommend the other track.
    requested_program: LoanProgram | None = None
    # Optional lender overlay for RAG + offer-matrix routing (e.g. accion).
    lender_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PolicySource(BaseModel):
    """Provenance for a policy document (precedence by authority / recency)."""

    source_id: str
    name: str
    authority: Literal["regulatory", "sba", "lender"]
    version: str
    effective_date: datetime
    # Layer tag mirrored from chunk metadata ``program``.
    program: PolicyLayer = PolicyLayer.COMPLIANCE_FLOOR
    # Lender overlay from chunk metadata / catalog (null = shared / generic).
    lender_id: str | None = None
    # Catalog display title (falls back to ``name`` / filename in the UI).
    title: str | None = None
    # Origin / download URL from ``data/policy_sources/catalog.json``.
    url: str | None = None


class Citation(BaseModel):
    """Retrieved clause. grounding_* set by critique — never self-reported."""

    clause_id: str
    source: PolicySource
    retrieved_text: str
    similarity_score: float = Field(ge=0, le=1)
    program: PolicyLayer = PolicyLayer.COMPLIANCE_FLOOR
    grounding_score: Optional[float] = Field(default=None, ge=0, le=1)
    grounded: Optional[bool] = None


class FinancialMetrics(BaseModel):
    """Deterministic ratios from the financial subagent."""

    debt_to_income: Optional[float] = None
    debt_service_coverage: Optional[float] = None
    risk_score: float = Field(ge=0, le=1, default=0.5)
    risk_tier: RiskTier = RiskTier.MEDIUM
    recommended_term_mods: list[str] = Field(default_factory=list)
    extras: dict[str, float] = Field(default_factory=dict)


class PolicyConflict(BaseModel):
    """Surfaced (never silently resolved) conflict between two clauses."""

    clause_a: Citation
    clause_b: Citation
    precedence_rule: Optional[str] = None
    resolved: bool = False
    proposed_reading: Optional[str] = None


class ProgramRouting(BaseModel):
    """Which product track(s) the applicant fits — independent of approve/deny."""

    compliance_floor_pass: bool = True
    eligibility_gate_pass: bool = True
    eligible_programs: list[LoanProgram] = Field(default_factory=list)
    recommended_program: LoanProgram | None = None
    ineligible_reasons: dict[str, str] = Field(default_factory=dict)


class SubagentOutput(BaseModel):
    """Uniform output for financial + policy subagents."""

    agent: SubagentName
    conclusion: str
    confidence: float = Field(ge=0, le=1)
    reasoning_trace: str
    citations: list[Citation] = Field(default_factory=list)
    conflicts: list[PolicyConflict] = Field(default_factory=list)
    metrics: Optional[FinancialMetrics] = None
    program_routing: Optional[ProgramRouting] = None
    hard_reject: bool = False
    hard_reject_reason: Optional[str] = None
    provider_outage: bool = False
    provider_outage_reason: Optional[str] = None
    retry_index: int = 0
    produced_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# Adversarial critique
# ---------------------------------------------------------------------------


class SubagentCritique(BaseModel):
    agent: SubagentName
    passed: bool
    citation_grounding_failures: list[str] = Field(default_factory=list)
    unacknowledged_conflicts: list[str] = Field(default_factory=list)
    deficiencies: list[str] = Field(default_factory=list)


class CritiqueReport(BaseModel):
    verdict: CritiqueVerdict
    per_agent: list[SubagentCritique] = Field(default_factory=list)
    rerun_targets: list[SubagentName] = Field(default_factory=list)
    critic_confidence: float = Field(ge=0, le=1, default=1.0)
    notes: str = ""
    cycle: int = 0
    critiqued_at: datetime = Field(default_factory=_now)

    @property
    def needs_retry(self) -> bool:
        return self.verdict == CritiqueVerdict.RETRY and bool(self.rerun_targets)


# ---------------------------------------------------------------------------
# Decision + human review
# ---------------------------------------------------------------------------


class CompositeScore(BaseModel):
    subagent_agreement: float = Field(ge=0, le=1)
    evidence_coverage: float = Field(ge=0, le=1)
    calibration_adjustment: float = 0.0
    composite: float = Field(ge=0, le=1)


class AdverseActionReason(BaseModel):
    """ECOA/Reg B individualized denial reason."""

    reason_code: str
    description: str
    supporting_citations: list[str] = Field(default_factory=list)


class ImprovementArea(StrEnum):
    FINANCIAL = "financial"
    CREDIT = "credit"
    POLICY = "policy"
    PROGRAM = "program"
    STRUCTURE = "structure"


class ImprovementPriority(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ImprovementAction(BaseModel):
    """Concrete step that would improve auto-approve odds."""

    area: ImprovementArea
    priority: ImprovementPriority = ImprovementPriority.MEDIUM
    title: str
    detail: str
    target: str | None = None


class RationaleKind(StrEnum):
    FINANCIAL = "financial"
    POLICY = "policy"
    CRITIC = "critic"
    ENVELOPE = "envelope"
    HARD_REJECT = "hard_reject"
    HUMAN = "human"
    ROUTING = "routing"
    GENERAL = "general"


class RationaleFactTone(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    WARN = "warn"
    NEUTRAL = "neutral"
    INFO = "info"


class RationaleFact(BaseModel):
    """Single labeled metric/fact for UI rendering (not raw key=value prose)."""

    key: str
    label: str
    value: str
    tone: RationaleFactTone = RationaleFactTone.NEUTRAL
    detail: str | None = None


class RationaleSection(BaseModel):
    """One labeled block inside a decision rationale (UI-friendly)."""

    kind: RationaleKind = RationaleKind.GENERAL
    title: str
    body: str = ""
    facts: list[RationaleFact] = Field(default_factory=list)


class DecisionRationale(BaseModel):
    """Structured underwriting rationale — summary + optional sections."""

    summary: str
    sections: list[RationaleSection] = Field(default_factory=list)

    @property
    def text(self) -> str:
        """Flat string for evals / audit hashing that expect prose."""
        parts: list[str] = []
        if self.summary.strip():
            parts.append(self.summary.strip())
        for section in self.sections:
            body = section.body.strip()
            if body and body != self.summary.strip():
                parts.append(body)
        return "; ".join(parts)

    def __str__(self) -> str:
        return self.text

    @classmethod
    def from_text(
        cls,
        text: str,
        *,
        kind: RationaleKind = RationaleKind.GENERAL,
        title: str | None = None,
    ) -> DecisionRationale:
        cleaned = (text or "").strip()
        if not cleaned:
            return cls(summary="", sections=[])
        section_title = title or kind.value.replace("_", " ").title()
        return cls(
            summary=cleaned,
            sections=[
                RationaleSection(kind=kind, title=section_title, body=cleaned)
            ],
        )

    def with_section(
        self,
        *,
        kind: RationaleKind,
        title: str,
        body: str,
        facts: list[RationaleFact] | None = None,
        update_summary: bool = False,
    ) -> DecisionRationale:
        cleaned = (body or "").strip()
        if not cleaned and not facts:
            return self
        sections = [
            *self.sections,
            RationaleSection(
                kind=kind,
                title=title,
                body=cleaned,
                facts=list(facts or []),
            ),
        ]
        summary = cleaned if update_summary or not self.summary.strip() else self.summary
        if not summary and facts:
            summary = title
        return self.model_copy(update={"summary": summary, "sections": sections})


def _coerce_decision_rationale(value: Any) -> Any:
    if isinstance(value, DecisionRationale):
        return value
    if isinstance(value, str):
        return DecisionRationale.from_text(value)
    return value


DecisionRationaleField = Annotated[
    DecisionRationale, BeforeValidator(_coerce_decision_rationale)
]


class Decision(BaseModel):
    outcome: DecisionOutcome
    origin: DecisionOrigin
    risk_tier: RiskTier
    ceiling_triggered: bool
    composite_score: Optional[CompositeScore] = None
    rationale: DecisionRationaleField
    program_routing: Optional[ProgramRouting] = None
    adverse_action_reasons: list[AdverseActionReason] = Field(default_factory=list)
    term_modifications: list[str] = Field(default_factory=list)
    improvement_actions: list[ImprovementAction] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    decided_at: datetime = Field(default_factory=_now)


class EscalationPackage(BaseModel):
    """Evidence bundle for the Human Review UI / resolution queue."""

    reason: str
    rationale: DecisionRationaleField = Field(
        default_factory=lambda: DecisionRationale(summary="", sections=[])
    )
    financial_summary: str = ""
    compliance_summary: str = ""
    citations: list[Citation] = Field(default_factory=list)
    critic_notes: str = ""
    sla_queue: str = "underwriter_review"


class HumanReviewRecord(BaseModel):
    """Terminal human decision. Ceiling override requires maker-checker."""

    reviewer_id: str
    outcome: DecisionOutcome
    rationale: str
    overrode_ceiling: bool = False
    override_confirmed_by: Optional[str] = None
    reviewed_at: datetime = Field(default_factory=_now)
    pending: bool = False


class AuditEntry(BaseModel):
    """Tamper-evident audit record (hash-chained)."""

    case_id: str
    event: str
    payload: dict[str, Any]
    prev_hash: Optional[str]
    entry_hash: str
    logged_at: datetime = Field(default_factory=_now)


# Backward-compatible aliases
PolicyCitation = Citation
PolicyMatch = Citation
FinancialReport = FinancialMetrics
FinancialAnalysis = FinancialMetrics
CriticTarget = SubagentName
CriticReport = CritiqueReport
DecisionResult = Decision
AuditLogEntry = AuditEntry
