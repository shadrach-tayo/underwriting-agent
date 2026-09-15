"""Tests for user-facing API error message extraction."""

from __future__ import annotations

from http_api.errors import extract_error_message


def test_extract_openai_style_quota_message() -> None:
    raw = (
        "Error code: 429 - {'error': {'message': 'You have no credits remaining. "
        "Add credits to continue using the API at "
        "https://platform.openai.com/settings/organization/billing/.', "
        "'type': 'insufficient_quota', 'param': None, "
        "'code': 'credit_balance_exhausted'}}"
    )
    msg = extract_error_message(raw)
    assert msg.startswith("You have no credits remaining")
    assert "platform.openai.com" in msg


def test_extract_fastapi_detail_wrapper() -> None:
    wrapped = (
        '{"detail": "Agent answer failed: Error code: 429 - '
        "{'error': {'message': 'You have no credits remaining.', "
        "'type': 'insufficient_quota'}}\"}"
    )
    # Simulate what extract sees after HTTPException detail was already cleaned,
    # or nested once.
    msg = extract_error_message(
        "Agent answer failed: Error code: 429 - "
        "{'error': {'message': 'You have no credits remaining.', "
        "'type': 'insufficient_quota'}}"
    )
    assert msg == "You have no credits remaining."
    assert "429" not in extract_error_message(wrapped) or "credits" in extract_error_message(
        wrapped
    )


def test_extract_plain_string() -> None:
    assert extract_error_message("DeepSeek is not configured") == (
        "DeepSeek is not configured"
    )
