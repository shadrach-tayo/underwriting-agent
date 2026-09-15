"""Turn provider / FastAPI exceptions into short user-facing messages."""

from __future__ import annotations

import json
import re
from typing import Any


def extract_error_message(exc: BaseException | str) -> str:
    """Pull the innermost human message out of OpenAI/DeepSeek-style errors."""
    text = str(exc).strip()
    if not text:
        return "Unknown error"

    # OpenAI SDK: Error code: 429 - {'error': {'message': '...', ...}}
    dict_match = re.search(r"(\{[^{}]*'error'[^{}]*\{.*?\}.*\})", text, re.DOTALL)
    if dict_match:
        blob = dict_match.group(1)
        try:
            # Prefer JSON if the provider used double quotes.
            parsed = json.loads(blob.replace("'", '"').replace("None", "null"))
            nested = _message_from_mapping(parsed)
            if nested:
                return nested
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
        # Fallback: message': '...'
        msg_match = re.search(r"['\"]message['\"]\s*:\s*['\"]([^'\"]+)['\"]", blob)
        if msg_match:
            return msg_match.group(1).strip()

    # FastAPI / JSON body already stringified
    if text.startswith("{") and "detail" in text:
        try:
            parsed = json.loads(text)
            nested = _message_from_mapping(parsed)
            if nested:
                return nested
        except json.JSONDecodeError:
            pass

    # Strip common SDK prefixes
    for prefix in ("Error code: ", "Agent answer failed: ", "Retrieval failed: "):
        if text.startswith(prefix) or prefix in text:
            # Keep trailing human part when present after " - "
            if " - " in text:
                tail = text.rsplit(" - ", 1)[-1].strip()
                nested = extract_error_message(tail)
                if nested != tail or not nested.startswith("{"):
                    return nested
    return text


def _message_from_mapping(data: Any) -> str | None:
    if not isinstance(data, dict):
        return None
    detail = data.get("detail")
    if isinstance(detail, str) and detail.strip():
        # detail may itself be "Agent answer failed: Error code: 429 - {...}"
        return extract_error_message(detail)
    if isinstance(detail, dict):
        nested = _message_from_mapping(detail)
        if nested:
            return nested
    err = data.get("error")
    if isinstance(err, dict):
        msg = err.get("message")
        if isinstance(msg, str) and msg.strip():
            return msg.strip()
    msg = data.get("message")
    if isinstance(msg, str) and msg.strip():
        return msg.strip()
    return None
