"""Generate the gold set from Fed SBCS calibration priors + policy layers.

Calibration priors are drawn from the Fed 2025 Small Business Credit Survey
employer-firm / Firms in Focus framing in ``data/calibration policy/``:
revenue size, firm age, industry, and credit-risk segments.

Labels apply the dual-program stack (not a flat merge):
  compliance_floor → eligibility_gate → sba_7a | cdfi_direct
"""

from __future__ import annotations

import json
from pathlib import Path

from evals.gold_set import GOLD_SET_PATH, GoldCase, GoldLabel
from agents.program_routing import compute_program_routing
from models import Applicant, DecisionOutcome, LoanProgram, RiskTier

# Re-export routing constants for callers / docs that imported them here.
from agents.program_routing import (  # noqa: F401
    CDFI_REVENUE_MIN,
    CDFI_YEARS_MIN,
    INELIGIBLE_INDUSTRIES,
    SBSS_SBA_MIN,
)


def _label_applicant(applicant: Applicant, *, tags: list[str], rationale: str, refs: list[str]) -> GoldLabel:
    routing = compute_program_routing(applicant)
    compliance_ok = routing.compliance_floor_pass
    eligibility_ok = routing.eligibility_gate_pass
    hard_reject = applicant.has_bankruptcy or applicant.has_severe_fraud_alert
    eligible = [p.value for p in routing.eligible_programs]
    recommended = (
        routing.recommended_program.value if routing.recommended_program else None
    )

    # Outcome
    if not compliance_ok:
        outcome = DecisionOutcome.DENY
        risk = RiskTier.PROHIBITED
    elif hard_reject:
        outcome = DecisionOutcome.DENY
        risk = RiskTier.PROHIBITED
    elif not eligibility_ok:
        outcome = DecisionOutcome.DENY
        risk = RiskTier.HIGH
    elif routing.ineligible_reasons.get("lender_program_mismatch"):
        # Lender × program mismatch is a human-review escalate, matching the policy subagent.
        outcome = DecisionOutcome.ESCALATE
        risk = RiskTier.MEDIUM
    elif not eligible:
        # Clear program miss but not fraud — deny with adverse action, or escalate if thin-file edge.
        if applicant.metadata.get("borderline"):
            outcome = DecisionOutcome.ESCALATE
            risk = RiskTier.HIGH
        else:
            outcome = DecisionOutcome.DENY
            risk = RiskTier.HIGH
    else:
        dscr = applicant.debt_service_coverage_ratio
        loan_to_rev = applicant.requested_loan_amount / max(applicant.annual_revenue, 1.0)
        fico = applicant.credit_score_proxy or 0
        # Softer FICO bar when only the CDFI track clears (Accion-style soft floor).
        fico_floor = 680 if "sba_7a" in eligible else 640
        if applicant.metadata.get("borderline") or (dscr is not None and 1.15 <= dscr < 1.25) or loan_to_rev > 0.75:
            outcome = DecisionOutcome.ESCALATE
            risk = RiskTier.MEDIUM
        elif dscr is not None and dscr >= 1.25 and fico >= fico_floor:
            outcome = DecisionOutcome.APPROVE
            risk = RiskTier.LOW
        else:
            outcome = DecisionOutcome.ESCALATE
            risk = RiskTier.MEDIUM

    return GoldLabel(
        outcome=outcome,
        compliance_floor_pass=compliance_ok,
        eligibility_gate_pass=eligibility_ok and not hard_reject,
        eligible_programs=eligible,  # type: ignore[arg-type]
        recommended_program=recommended,  # type: ignore[arg-type]
        risk_tier=risk,
        rationale=rationale,
        calibration_tags=tags,
        policy_refs=refs,
    )


def _case(
    case_id: str,
    *,
    applicant: Applicant,
    tags: list[str],
    rationale: str,
    refs: list[str],
) -> GoldCase:
    # Recompute labels deterministically from applicant fields.
    label = _label_applicant(applicant, tags=tags, rationale=rationale, refs=refs)
    return GoldCase(case_id=case_id, applicant=applicant, label=label)


def build_cases() -> list[GoldCase]:
    """Hand-tuned cohort covering routing + outcome strata (42 cases)."""
    cases: list[GoldCase] = []

    # --- Clear SBA 7(a) + CDFI (both) — approve ---
    cases.append(
        _case(
            "gold-001",
            applicant=Applicant(
                applicant_id="A-001",
                business_name="Cedar Ridge Fabrication LLC",
                industry="manufacturing",
                annual_revenue=1_250_000,
                requested_loan_amount=250_000,
                years_in_business=7,
                debt_service_coverage_ratio=1.45,
                credit_score_proxy=720,
                sbss_proxy=185,
                requested_program=LoanProgram.SBA_7A,
            ),
            tags=["sbcs_revenue_1m_5m", "firm_age_6plus", "industry_manufacturing", "credit_low_risk"],
            rationale="Strong employer firm; clears SBSS 165+ and CDFI floors; DSCR healthy → approve on SBA track.",
            refs=["eligibility_gate", "sba_7a", "cdfi_direct", "sbcs_employer_firms_2025"],
        )
    )

    # --- Both eligible, prefer CDFI (requested) — approve ---
    cases.append(
        _case(
            "gold-002",
            applicant=Applicant(
                applicant_id="A-002",
                business_name="Harbor Dental Supply Co.",
                industry="wholesale trade",
                annual_revenue=680_000,
                requested_loan_amount=120_000,
                years_in_business=4,
                debt_service_coverage_ratio=1.38,
                credit_score_proxy=705,
                sbss_proxy=172,
                requested_program=LoanProgram.CDFI_DIRECT,
            ),
            tags=["sbcs_revenue_100k_1m", "firm_age_2_5", "industry_wholesale", "credit_low_risk"],
            rationale="Eligible for both; applicant requested CDFI direct; capacity supports auto-approve.",
            refs=["sba_7a", "cdfi_direct", "sbcs_revenue_size"],
        )
    )

    # --- SBA fail SBSS, CDFI pass — recommend cdfi_direct (routing star case) ---
    cases.append(
        _case(
            "gold-003",
            applicant=Applicant(
                applicant_id="A-003",
                business_name="Bright Lane Bakery",
                industry="food services",
                annual_revenue=210_000,
                requested_loan_amount=45_000,
                years_in_business=2.5,
                debt_service_coverage_ratio=1.30,
                credit_score_proxy=655,
                sbss_proxy=148,
                requested_program=LoanProgram.SBA_7A,
            ),
            tags=["sbcs_revenue_100k_1m", "firm_age_2_5", "industry_food", "credit_medium_risk"],
            rationale="Fails SBA SBSS 165; clears CDFI $50k + 12mo → recommend cdfi_direct, not flat deny.",
            refs=["sba_7a", "cdfi_direct", "sbcs_credit_risk"],
        )
    )

    # --- CDFI fail revenue, SBA pass ---
    cases.append(
        _case(
            "gold-004",
            applicant=Applicant(
                applicant_id="A-004",
                business_name="Nova IT Advisors",
                industry="professional services",
                annual_revenue=42_000,
                requested_loan_amount=35_000,
                years_in_business=3,
                debt_service_coverage_ratio=1.50,
                credit_score_proxy=740,
                sbss_proxy=190,
                requested_program=LoanProgram.CDFI_DIRECT,
            ),
            tags=["sbcs_revenue_under_100k", "firm_age_2_5", "industry_professional", "credit_low_risk"],
            rationale="Below CDFI $50k revenue floor; strong SBSS → SBA-only route (may still escalate on size).",
            refs=["cdfi_direct", "sba_7a", "sbcs_revenue_size"],
        )
    )
    # Override: low revenue + small loan with strong credit → escalate not auto-approve
    cases[-1].label.outcome = DecisionOutcome.ESCALATE
    cases[-1].label.risk_tier = RiskTier.MEDIUM
    cases[-1].label.rationale += " Thin revenue vs. employer-firm norms → escalate for human review."

    # --- Startup <12mo: neither CDFI nor (typically) comfortable SBA without equity story ---
    cases.append(
        _case(
            "gold-005",
            applicant=Applicant(
                applicant_id="A-005",
                business_name="Spark Mobile Detailing",
                industry="other services",
                annual_revenue=95_000,
                requested_loan_amount=40_000,
                years_in_business=0.6,
                debt_service_coverage_ratio=1.20,
                credit_score_proxy=670,
                sbss_proxy=160,
            ),
            tags=["sbcs_revenue_under_100k", "firm_age_under_2", "industry_services", "credit_medium_risk"],
            rationale="Under 12 months → fails CDFI tenure; SBSS below 165 → neither program; deny/escalate.",
            refs=["cdfi_direct", "sba_7a", "sbcs_firm_age"],
        )
    )

    # --- Ineligible business type ---
    cases.append(
        _case(
            "gold-006",
            applicant=Applicant(
                applicant_id="A-006",
                business_name="Lucky Star Gaming Lounge",
                industry="gambling",
                annual_revenue=900_000,
                requested_loan_amount=200_000,
                years_in_business=5,
                debt_service_coverage_ratio=1.60,
                credit_score_proxy=710,
                sbss_proxy=180,
            ),
            tags=["sbcs_revenue_100k_1m", "industry_ineligible", "credit_low_risk"],
            rationale="Fails shared eligibility_gate (ineligible business type) before program scoring → deny.",
            refs=["eligibility_gate", "13_cfr_120_110"],
        )
    )

    # --- Bankruptcy hard reject ---
    cases.append(
        _case(
            "gold-007",
            applicant=Applicant(
                applicant_id="A-007",
                business_name="Old Mill Retail Group",
                industry="retail trade",
                annual_revenue=400_000,
                requested_loan_amount=80_000,
                years_in_business=8,
                debt_service_coverage_ratio=1.10,
                credit_score_proxy=580,
                sbss_proxy=120,
                has_bankruptcy=True,
            ),
            tags=["sbcs_revenue_100k_1m", "firm_age_6plus", "industry_retail", "credit_high_risk"],
            rationale="Bankruptcy → hard reject / deny; no program scoring.",
            refs=["eligibility_gate", "cdfi_direct", "hard_reject"],
        )
    )

    # --- Fraud hard reject ---
    cases.append(
        _case(
            "gold-008",
            applicant=Applicant(
                applicant_id="A-008",
                business_name="Summit Freight Partners",
                industry="transportation",
                annual_revenue=1_100_000,
                requested_loan_amount=300_000,
                years_in_business=6,
                debt_service_coverage_ratio=1.40,
                credit_score_proxy=700,
                sbss_proxy=175,
                has_severe_fraud_alert=True,
            ),
            tags=["sbcs_revenue_1m_5m", "firm_age_6plus", "industry_transport", "credit_low_risk"],
            rationale="Severe fraud alert → hard reject / deny.",
            refs=["hard_reject", "compliance_floor"],
        )
    )

    # --- Compliance floor failure (ECOA process violation flag) ---
    cases.append(
        _case(
            "gold-009",
            applicant=Applicant(
                applicant_id="A-009",
                business_name="Prairie Veterinary Clinic",
                industry="healthcare",
                annual_revenue=550_000,
                requested_loan_amount=100_000,
                years_in_business=9,
                debt_service_coverage_ratio=1.55,
                credit_score_proxy=730,
                sbss_proxy=188,
                metadata={"compliance_violation": True},
            ),
            tags=["sbcs_revenue_100k_1m", "firm_age_6plus", "industry_healthcare"],
            rationale="compliance_floor fail (process/fair-lending flag) → deny independent of credit strength.",
            refs=["compliance_floor", "ecoa_reg_b"],
        )
    )

    # --- Borderline DSCR → escalate, both programs ---
    cases.append(
        _case(
            "gold-010",
            applicant=Applicant(
                applicant_id="A-010",
                business_name="Lakeside HVAC Services",
                industry="construction",
                annual_revenue=780_000,
                requested_loan_amount=150_000,
                years_in_business=5,
                debt_service_coverage_ratio=1.18,
                credit_score_proxy=690,
                sbss_proxy=170,
                metadata={"borderline": True},
            ),
            tags=["sbcs_revenue_100k_1m", "firm_age_2_5", "industry_construction", "credit_medium_risk"],
            rationale="Clears both program gates but DSCR borderline → escalate.",
            refs=["sba_7a", "cdfi_direct"],
        )
    )

    # --- High loan-to-revenue → escalate ---
    cases.append(
        _case(
            "gold-011",
            applicant=Applicant(
                applicant_id="A-011",
                business_name="Urban Bloom Florist",
                industry="retail trade",
                annual_revenue=160_000,
                requested_loan_amount=140_000,
                years_in_business=3,
                debt_service_coverage_ratio=1.28,
                credit_score_proxy=675,
                sbss_proxy=155,
            ),
            tags=["sbcs_revenue_100k_1m", "firm_age_2_5", "industry_retail", "credit_medium_risk"],
            rationale="CDFI-only (SBSS<165); loan/revenue high → escalate on CDFI track.",
            refs=["cdfi_direct", "sba_7a"],
        )
    )

    # --- Rural micro employer, CDFI approve ---
    cases.append(
        _case(
            "gold-012",
            applicant=Applicant(
                applicant_id="A-012",
                business_name="High Plains Seed Co-op Store",
                industry="retail trade",
                annual_revenue=320_000,
                requested_loan_amount=60_000,
                years_in_business=11,
                debt_service_coverage_ratio=1.42,
                credit_score_proxy=700,
                sbss_proxy=150,
                metadata={"geography": "rural"},
            ),
            tags=["sbcs_revenue_100k_1m", "firm_age_6plus", "geography_rural", "credit_low_risk"],
            rationale="Rural SBCS segment; SBSS below SBA floor; strong CDFI profile → approve CDFI.",
            refs=["cdfi_direct", "sbcs_rural_urban"],
        )
    )

    # --- Large employer firm, SBA approve ---
    cases.append(
        _case(
            "gold-013",
            applicant=Applicant(
                applicant_id="A-013",
                business_name="Metro Precision Machine Works",
                industry="manufacturing",
                annual_revenue=4_200_000,
                requested_loan_amount=750_000,
                years_in_business=15,
                debt_service_coverage_ratio=1.55,
                credit_score_proxy=760,
                sbss_proxy=210,
                requested_program=LoanProgram.SBA_7A,
                metadata={"employment_size": "50-99"},
            ),
            tags=["sbcs_revenue_1m_5m", "firm_age_6plus", "employment_50_99", "credit_low_risk"],
            rationale="Larger employer firm per SBCS size bands; clears SBA comfortably → approve SBA.",
            refs=["sba_7a", "sbcs_employment_size"],
        )
    )

    # --- Thin file / missing SBSS → CDFI escalate ---
    cases.append(
        _case(
            "gold-014",
            applicant=Applicant(
                applicant_id="A-014",
                business_name="Nueva Cocina Catering",
                industry="food services",
                annual_revenue=125_000,
                requested_loan_amount=35_000,
                years_in_business=1.5,
                debt_service_coverage_ratio=1.22,
                credit_score_proxy=620,
                sbss_proxy=None,
                metadata={"borderline": True, "thin_file": True},
            ),
            tags=["sbcs_revenue_100k_1m", "firm_age_under_2", "industry_food", "credit_medium_risk"],
            rationale="No SBSS → not SBA; meets CDFI floors but thin-file/borderline DSCR → escalate CDFI.",
            refs=["cdfi_direct", "sba_7a"],
        )
    )

    # --- Neither: revenue too low and weak credit ---
    cases.append(
        _case(
            "gold-015",
            applicant=Applicant(
                applicant_id="A-015",
                business_name="Sidewalk Snacks Cart LLC",
                industry="food services",
                annual_revenue=28_000,
                requested_loan_amount=15_000,
                years_in_business=2,
                debt_service_coverage_ratio=0.95,
                credit_score_proxy=540,
                sbss_proxy=110,
            ),
            tags=["sbcs_revenue_under_100k", "firm_age_2_5", "credit_high_risk"],
            rationale="Below CDFI revenue; fails SBA SBSS/DSCR → neither → deny.",
            refs=["cdfi_direct", "sba_7a"],
        )
    )

    # Fill remaining cases with calibrated variety
    templates: list[dict] = [
        dict(
            cid="gold-016",
            name="Bluebird Daycare Center",
            industry="healthcare",
            rev=480_000,
            loan=90_000,
            years=6,
            dscr=1.35,
            fico=710,
            sbss=176,
            tags=["sbcs_revenue_100k_1m", "industry_healthcare", "firm_age_6plus"],
            rationale="Both programs; solid DSCR → approve SBA default.",
            refs=["sba_7a", "cdfi_direct"],
            program=LoanProgram.SBA_7A,
        ),
        dict(
            cid="gold-017",
            name="Kitama Auto Repair",
            industry="other services",
            rev=190_000,
            loan=55_000,
            years=4,
            dscr=1.27,
            fico=660,
            sbss=158,
            tags=["sbcs_revenue_100k_1m", "industry_services", "credit_medium_risk"],
            rationale="SBSS under 165; CDFI ok → recommend cdfi_direct approve.",
            refs=["cdfi_direct"],
        ),
        dict(
            cid="gold-018",
            name="Atlas Software Studio",
            industry="professional services",
            rev=2_100_000,
            loan=400_000,
            years=8,
            dscr=1.48,
            fico=750,
            sbss=200,
            tags=["sbcs_revenue_1m_5m", "industry_professional", "credit_low_risk"],
            rationale="Strong professional-services employer firm → approve SBA.",
            refs=["sba_7a", "sbcs_industry"],
            program=LoanProgram.SBA_7A,
        ),
        dict(
            cid="gold-019",
            name="Riverbend Farm Market",
            industry="retail trade",
            rev=75_000,
            loan=25_000,
            years=1.2,
            dscr=1.15,
            fico=640,
            sbss=140,
            tags=["sbcs_revenue_under_100k", "geography_rural", "firm_age_under_2"],
            rationale="Clears CDFI barely; weak DSCR band → escalate CDFI.",
            refs=["cdfi_direct"],
            borderline=True,
        ),
        dict(
            cid="gold-020",
            name="Coastal Charter Fishing",
            industry="arts entertainment recreation",
            rev=260_000,
            loan=70_000,
            years=5,
            dscr=1.33,
            fico=680,
            sbss=168,
            tags=["sbcs_revenue_100k_1m", "geography_urban", "credit_medium_risk"],
            rationale="Both programs; approve on SBA.",
            refs=["sba_7a", "cdfi_direct"],
        ),
        dict(
            cid="gold-021",
            name="Passive Holdings SPV",
            industry="passive investment holding",
            rev=500_000,
            loan=100_000,
            years=3,
            dscr=2.0,
            fico=780,
            sbss=220,
            tags=["industry_ineligible"],
            rationale="Ineligible holding company → eligibility_gate deny.",
            refs=["eligibility_gate"],
        ),
        dict(
            cid="gold-022",
            name="Twin Cities Print Shop",
            industry="manufacturing",
            rev=310_000,
            loan=85_000,
            years=9,
            dscr=1.12,
            fico=630,
            sbss=162,
            tags=["sbcs_revenue_100k_1m", "credit_medium_risk", "firm_age_6plus"],
            rationale="Near SBSS floor but DSCR weak and FICO soft → CDFI-eligible escalate.",
            refs=["cdfi_direct", "sba_7a"],
            borderline=True,
        ),
        dict(
            cid="gold-023",
            name="Sunrise Senior Transport",
            industry="transportation",
            rev=540_000,
            loan=110_000,
            years=3.5,
            dscr=1.40,
            fico=715,
            sbss=178,
            tags=["sbcs_revenue_100k_1m", "industry_transport", "credit_low_risk"],
            rationale="Both programs; approve SBA.",
            refs=["sba_7a", "cdfi_direct"],
            program=LoanProgram.SBA_7A,
        ),
        dict(
            cid="gold-024",
            name="GreenRoof Landscaping",
            industry="administrative support",
            rev=88_000,
            loan=30_000,
            years=2,
            dscr=1.26,
            fico=650,
            sbss=145,
            tags=["sbcs_revenue_under_100k", "firm_age_2_5"],
            rationale="CDFI-only; approve modest working-capital ask.",
            refs=["cdfi_direct"],
        ),
        dict(
            cid="gold-025",
            name="North End Boutique",
            industry="retail trade",
            rev=55_000,
            loan=20_000,
            years=1.0,
            dscr=1.31,
            fico=690,
            sbss=166,
            tags=["sbcs_revenue_under_100k", "firm_age_under_2", "credit_low_risk"],
            rationale="Just clears CDFI tenure/revenue; also clears SBSS → both; escalate on small-revenue band.",
            refs=["sba_7a", "cdfi_direct", "sbcs_revenue_size"],
            borderline=True,
        ),
        dict(
            cid="gold-026",
            name="Speculative Flip Properties LLC",
            industry="speculative real estate",
            rev=1_000_000,
            loan=400_000,
            years=4,
            dscr=1.25,
            fico=720,
            sbss=180,
            tags=["industry_ineligible"],
            rationale="Speculative real estate → eligibility deny.",
            refs=["eligibility_gate"],
        ),
        dict(
            cid="gold-027",
            name="Oak Street Pharmacy",
            industry="retail trade",
            rev=1_800_000,
            loan=350_000,
            years=12,
            dscr=1.52,
            fico=745,
            sbss=195,
            tags=["sbcs_revenue_1m_5m", "firm_age_6plus", "credit_low_risk"],
            rationale="Strong retail employer firm → approve SBA.",
            refs=["sba_7a", "cdfi_direct"],
            program=LoanProgram.SBA_7A,
        ),
        dict(
            cid="gold-028",
            name="Midnight Coffee Collective",
            industry="food services",
            rev=140_000,
            loan=50_000,
            years=2.2,
            dscr=1.05,
            fico=600,
            sbss=130,
            tags=["sbcs_revenue_100k_1m", "credit_high_risk", "industry_food"],
            rationale="CDFI revenue/tenure ok but weak DSCR/credit → escalate; not SBA.",
            refs=["cdfi_direct"],
            borderline=True,
        ),
        dict(
            cid="gold-029",
            name="Appalachia Woodworks",
            industry="manufacturing",
            rev=230_000,
            loan=65_000,
            years=7,
            dscr=1.36,
            fico=695,
            sbss=152,
            tags=["sbcs_revenue_100k_1m", "geography_rural", "firm_age_6plus"],
            rationale="Rural manufacturer; CDFI approve (SBSS short of SBA).",
            refs=["cdfi_direct", "sbcs_rural_urban"],
        ),
        dict(
            cid="gold-030",
            name="Bay Area UX Agency",
            industry="professional services",
            rev=920_000,
            loan=180_000,
            years=4,
            dscr=1.44,
            fico=735,
            sbss=182,
            tags=["sbcs_revenue_100k_1m", "geography_urban", "industry_professional"],
            rationale="Urban professional services; both programs → approve SBA.",
            refs=["sba_7a", "cdfi_direct", "sbcs_rural_urban"],
            program=LoanProgram.SBA_7A,
        ),
        dict(
            cid="gold-031",
            name="Desert Solar Install Co.",
            industry="construction",
            rev=1_450_000,
            loan=500_000,
            years=3,
            dscr=1.20,
            fico=670,
            sbss=169,
            tags=["sbcs_revenue_1m_5m", "industry_construction", "credit_medium_risk"],
            rationale="Both eligible; DSCR in escalate band → escalate.",
            refs=["sba_7a", "cdfi_direct"],
            borderline=True,
        ),
        dict(
            cid="gold-032",
            name="Community Childcare Network",
            industry="healthcare",
            rev=210_000,
            loan=40_000,
            years=5,
            dscr=1.29,
            fico=685,
            sbss=149,
            tags=["sbcs_revenue_100k_1m", "industry_healthcare"],
            rationale="CDFI-only approve.",
            refs=["cdfi_direct"],
        ),
        dict(
            cid="gold-033",
            name="FreshStart Cleaning",
            industry="administrative support",
            rev=48_000,
            loan=18_000,
            years=1.5,
            dscr=1.20,
            fico=610,
            sbss=125,
            tags=["sbcs_revenue_under_100k", "credit_medium_risk"],
            rationale="Under CDFI revenue; fails SBA → neither → deny.",
            refs=["cdfi_direct", "sba_7a"],
        ),
        dict(
            cid="gold-034",
            name="Ironclad Welding LLC",
            industry="manufacturing",
            rev=610_000,
            loan=125_000,
            years=10,
            dscr=1.41,
            fico=725,
            sbss=187,
            tags=["sbcs_revenue_100k_1m", "firm_age_6plus", "credit_low_risk"],
            rationale="Both; approve SBA.",
            refs=["sba_7a", "cdfi_direct"],
            program=LoanProgram.SBA_7A,
        ),
        dict(
            cid="gold-035",
            name="Pop-Up Fashion Weekends",
            industry="retail trade",
            rev=70_000,
            loan=22_000,
            years=0.8,
            dscr=1.15,
            fico=640,
            sbss=155,
            tags=["sbcs_revenue_under_100k", "firm_age_under_2"],
            rationale="Fails CDFI tenure; SBSS <165 → neither → deny.",
            refs=["cdfi_direct", "sba_7a", "sbcs_firm_age"],
        ),
        dict(
            cid="gold-036",
            name="Midwest Cold Storage",
            industry="wholesale trade",
            rev=3_500_000,
            loan=600_000,
            years=14,
            dscr=1.60,
            fico=770,
            sbss=215,
            tags=["sbcs_revenue_1m_5m", "employment_20_49", "credit_low_risk"],
            rationale="Larger wholesale employer; approve SBA.",
            refs=["sba_7a", "sbcs_employment_size"],
            program=LoanProgram.SBA_7A,
        ),
        dict(
            cid="gold-037",
            name="Lantern Bookstore",
            industry="retail trade",
            rev=95_000,
            loan=28_000,
            years=6,
            dscr=1.24,
            fico=665,
            sbss=142,
            tags=["sbcs_revenue_under_100k", "firm_age_6plus", "credit_medium_risk"],
            rationale="CDFI-only; DSCR escalate band → escalate.",
            refs=["cdfi_direct"],
            borderline=True,
        ),
        dict(
            cid="gold-038",
            name="CityLine Plumbing",
            industry="construction",
            rev=430_000,
            loan=95_000,
            years=8,
            dscr=1.37,
            fico=700,
            sbss=174,
            tags=["sbcs_revenue_100k_1m", "geography_urban", "firm_age_6plus"],
            rationale="Both; approve SBA.",
            refs=["sba_7a", "cdfi_direct"],
            program=LoanProgram.SBA_7A,
        ),
        dict(
            cid="gold-039",
            name="Harvest CSA Kitchen",
            industry="food services",
            rev=180_000,
            loan=50_000,
            years=2,
            dscr=1.32,
            fico=680,
            sbss=151,
            tags=["sbcs_revenue_100k_1m", "industry_food", "credit_medium_risk"],
            rationale="Routing case: not SBA (SBSS); CDFI approve.",
            refs=["cdfi_direct", "sba_7a"],
        ),
        dict(
            cid="gold-040",
            name="Quantum Bio Lab Services",
            industry="professional services",
            rev=2_800_000,
            loan=500_000,
            years=5,
            dscr=1.10,
            fico=710,
            sbss=180,
            tags=["sbcs_revenue_1m_5m", "credit_low_risk", "industry_professional"],
            rationale="Clears SBA SBSS but weak DSCR → escalate despite program eligibility.",
            refs=["sba_7a", "cdfi_direct"],
            borderline=True,
            program=LoanProgram.SBA_7A,
        ),
    ]

    for t in templates:
        aid = t["cid"].replace("gold-", "A-")
        applicant = Applicant(
            applicant_id=aid,
            business_name=t["name"],
            industry=t["industry"],
            annual_revenue=float(t["rev"]),
            requested_loan_amount=float(t["loan"]),
            years_in_business=float(t["years"]),
            debt_service_coverage_ratio=float(t["dscr"]),
            credit_score_proxy=int(t["fico"]),
            sbss_proxy=int(t["sbss"]) if t.get("sbss") is not None else None,
            requested_program=t.get("program"),
            metadata={"borderline": True} if t.get("borderline") else {},
        )
        cases.append(
            _case(
                t["cid"],
                applicant=applicant,
                tags=list(t["tags"]),
                rationale=t["rationale"],
                refs=list(t["refs"]),
            )
        )

    # Lender × program mismatches (registry stubs; no local corpus required).
    accion_mismatch = _case(
        "gold-041",
        applicant=Applicant(
            applicant_id="A-041",
            business_name="Mismatch Accion CDFI Probe",
            industry="wholesale trade",
            annual_revenue=500_000,
            requested_loan_amount=150_000,
            years_in_business=5,
            debt_service_coverage_ratio=1.4,
            credit_score_proxy=700,
            sbss_proxy=180,
            requested_program=LoanProgram.CDFI_DIRECT,
            lender_id="accion",
            metadata={"adversarial": "lender_program_mismatch"},
        ),
        tags=["adversarial_lender_mismatch"],
        rationale=(
            "Accion originates SBA 7(a) only; CDFI Direct request is a "
            "lender×program mismatch → escalate."
        ),
        refs=["lender_program_mismatch", "accion"],
    )
    accion_mismatch.metadata = {"lender_id": "accion"}
    cases.append(accion_mismatch)

    frontier_mismatch = _case(
        "gold-042",
        applicant=Applicant(
            applicant_id="A-042",
            business_name="Mismatch Frontier CDFI Probe",
            industry="retail trade",
            annual_revenue=200_000,
            requested_loan_amount=60_000,
            years_in_business=3,
            debt_service_coverage_ratio=1.3,
            credit_score_proxy=650,
            sbss_proxy=170,
            requested_program=LoanProgram.CDFI_DIRECT,
            lender_id="frontier_7a",
            metadata={"adversarial": "lender_program_mismatch"},
        ),
        tags=["adversarial_lender_mismatch"],
        rationale=(
            "Frontier 7(a) does not originate CDFI Direct; "
            "lender×program mismatch → escalate."
        ),
        refs=["lender_program_mismatch", "frontier_7a"],
    )
    frontier_mismatch.metadata = {"lender_id": "frontier_7a"}
    cases.append(frontier_mismatch)

    return cases


def write_gold_set(path: Path | None = None) -> Path:
    target = path or GOLD_SET_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    cases = build_cases()
    with target.open("w", encoding="utf-8") as fh:
        for case in cases:
            fh.write(json.dumps(case.model_dump(mode="json"), ensure_ascii=False) + "\n")
    return target


def main() -> None:
    path = write_gold_set()
    from evals.gold_set import load_gold_cases, summarize_routes

    summary = summarize_routes(load_gold_cases(path))
    print(f"Wrote {summary} → {path}")


if __name__ == "__main__":
    main()
