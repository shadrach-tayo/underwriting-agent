"""Tests for user-facing API error message extraction."""

from __future__ import annotations

from http_api.errors import extract_error_message, public_dependency_error
from retries import DATABASE_UNAVAILABLE_MESSAGE


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


def test_extract_database_connection_failure() -> None:
    raw = (
        '(psycopg.OperationalError) connection failed: connection to server at "127.0.0.1", '
        "port 54326 failed: Connection refused\n"
        "Is the server running on that host and accepting TCP/IP connections?\n"
        "(Background on this error at: https://sqlalche.me/e/20/e3q8)"
    )
    assert extract_error_message(raw) == DATABASE_UNAVAILABLE_MESSAGE
    status_code, detail = public_dependency_error(RuntimeError(raw))
    assert status_code == 503
    assert detail == DATABASE_UNAVAILABLE_MESSAGE
    assert "54326" not in detail
    assert "sqlalche.me" not in detail
