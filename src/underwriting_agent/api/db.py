"""Postgres readiness helpers for admin /ready checks."""

from __future__ import annotations

import logging
from typing import Any

from underwriting_agent.config import Settings

logger = logging.getLogger(__name__)


def _psycopg_url(database_url: str) -> str:
    """Normalize SQLAlchemy-style URLs for raw psycopg connect."""
    if database_url.startswith("postgresql+psycopg://"):
        return "postgresql://" + database_url.removeprefix("postgresql+psycopg://")
    if database_url.startswith("postgresql+psycopg2://"):
        return "postgresql://" + database_url.removeprefix("postgresql+psycopg2://")
    return database_url


def ping_database(settings: Settings) -> bool:
    """Return True if Postgres accepts a connection."""
    try:
        import psycopg
        from psycopg import sql

        with psycopg.connect(_psycopg_url(settings.database_url), connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute(sql.SQL("SELECT 1"))
                cur.fetchone()
        return True
    except Exception as exc:  # noqa: BLE001 — readiness must never raise
        logger.warning("Database ping failed: %s", exc)
        return False


def index_stats(settings: Settings, index_name: str) -> dict[str, Any]:
    """Return whether the vector table exists and an approximate row count."""
    try:
        import psycopg
        from psycopg import sql

        with psycopg.connect(_psycopg_url(settings.database_url), connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL(
                        """
                        SELECT EXISTS (
                          SELECT 1
                          FROM information_schema.tables
                          WHERE table_schema = 'public' AND table_name = %s
                        )
                        """
                    ),
                    (index_name,),
                )
                exists_row = cur.fetchone()
                exists = bool(exists_row and exists_row[0])
                row_count: int | None = None
                if exists:
                    cur.execute(
                        sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(index_name))
                    )
                    count_row = cur.fetchone()
                    row_count = int(count_row[0]) if count_row else 0
                return {"index_exists": exists, "row_count": row_count}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Index stats failed: %s", exc)
        return {"index_exists": None, "row_count": None}
