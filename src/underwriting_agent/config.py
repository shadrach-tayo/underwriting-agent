"""Environment-backed settings. Risk ceiling is enforced in code, not prompts."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    langsmith_api_key: str | None = None
    langchain_tracing_v2: bool = False
    langchain_project: str = "underwriting-agent"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/underwriting"

    # Hard-coded risk ceiling: cases at/above this score must escalate.
    risk_ceiling: float = Field(default=0.75, ge=0.0, le=1.0)


@lru_cache
def get_settings() -> Settings:
    return Settings()
