"""Lender config extract / load tests."""

from __future__ import annotations

from agents.lender_config import (
    extract_rules_from_text,
    parse_front_matter_table,
)


SAMPLE = """
# Accion Opportunity Fund

|lender_id|accion|
|lender_name|Accion Opportunity Fund|
|program_id|sba_7a|
|source_url|https://aofund.org/business-loans/sba-small-business-loan/|
|document_version|1.0|

l[R13] Loan amount range: $100,000 to $350,000.
l[R12] The applicant must be a U.S. citizen.
"""


def test_parse_front_matter_table() -> None:
    meta = parse_front_matter_table(SAMPLE)
    assert meta["lender_id"] == "accion"
    assert meta["program_id"] == "sba_7a"
    assert "aofund.org" in meta["source_url"]


def test_extract_loan_band_and_citizen_rule() -> None:
    rules = extract_rules_from_text(SAMPLE)
    assert rules.loan_amount_min == 100_000
    assert rules.loan_amount_max == 350_000
    assert rules.requires_us_citizen is True
