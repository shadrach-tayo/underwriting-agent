"""FastAPI dependencies for settings and admin auth."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from underwriting_agent.config import Settings, get_settings


def settings_dep() -> Settings:
    return get_settings()


SettingsDep = Annotated[Settings, Depends(settings_dep)]


def require_admin(
    settings: SettingsDep,
    x_admin_key: Annotated[str | None, Header(alias="X-Admin-Key")] = None,
) -> None:
    """Enforce ``X-Admin-Key`` when ``ADMIN_API_KEY`` is configured."""
    expected = (settings.admin_api_key or "").strip()
    if not expected:
        return
    if not x_admin_key or x_admin_key.strip() != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-Key",
        )
