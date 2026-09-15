"""Environment-backed settings. Risk ceiling is enforced in code, not prompts."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

IngestTarget = Literal["vector", "hybrid"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    voyage_api_key: str | None = None
    langsmith_api_key: str | None = None
    langsmith_tracing: bool = False
    langsmith_project: str = "underwriting-agent"
    # Braintrust — evals + optional runtime tracing
    braintrust_api_key: str | None = None
    braintrust_tracing: bool = False
    braintrust_project: str = "underwriting-agent"
    braintrust_dataset: str = "underwriting-gold-set"
    # Legacy LangChain aliases (still read from env for older tooling)
    langchain_tracing_v2: bool = False
    langchain_project: str = "underwriting-agent"
    database_url: str = (
        "postgresql+psycopg://underwriting:underwriting@localhost:54326/underwriting_db"
    )

    # Hard-coded risk ceiling: cases at/above this score must escalate.
    risk_ceiling: float = Field(default=0.75, ge=0.0, le=1.0)

    # --- RAG / ingest (defaults: pgvector only; ES hybrid opt-in later) ---
    rag_index_name: str = "underwriting_policy_chunk_512"
    rag_chunk_size: int = Field(default=512, ge=64, le=4096)
    rag_chunk_overlap: int = Field(default=50, ge=0, le=512)
    rag_embedding_model: str = "voyage-3.5"
    rag_embedding_dim: int = Field(default=1024, ge=64)
    rag_strategy: Literal["vector", "hybrid", "ensemble"] = "vector"
    rag_top_k: int = Field(default=5, ge=1, le=50)
    # Comma-separated ingest backends. Default is pgvector only.
    rag_ingest_targets: str = "vector"
    rag_allow_hybrid: bool = False

    # --- Admin API ---
    # When set, /admin/* requires header X-Admin-Key. Empty = open (local only).
    admin_api_key: str | None = None
    api_host: str = "127.0.0.1"
    api_port: int = Field(default=8080, ge=1, le=65535)
    # Uvicorn auto-reload for local API development (set API_RELOAD=false in prod).
    api_reload: bool = True
    # Comma-separated browser origins allowed to call the API (Next.js console).
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @field_validator("rag_ingest_targets", mode="before")
    @classmethod
    def _normalize_targets(cls, value: object) -> object:
        if isinstance(value, (list, tuple)):
            return ",".join(str(v).strip() for v in value if str(v).strip())
        return value

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def ingest_targets(self) -> tuple[IngestTarget, ...]:
        """Parsed ingest targets; rejects hybrid unless ``rag_allow_hybrid``."""
        raw = [t.strip().lower() for t in self.rag_ingest_targets.split(",") if t.strip()]
        if not raw:
            raw = ["vector"]
        allowed: set[str] = {"vector"}
        if self.rag_allow_hybrid:
            allowed.add("hybrid")
        unknown = [t for t in raw if t not in {"vector", "hybrid"}]
        if unknown:
            raise ValueError(f"Unknown ingest targets: {', '.join(unknown)}")
        blocked = [t for t in raw if t not in allowed]
        if blocked:
            raise ValueError(
                f"Ingest targets not enabled for this project: {', '.join(blocked)}. "
                "Set RAG_ALLOW_HYBRID=true to enable Elasticsearch hybrid (not used yet)."
            )
        # Preserve order, dedupe
        out: list[IngestTarget] = []
        for t in raw:
            if t not in out:
                out.append(t)  # type: ignore[arg-type]
        return tuple(out)


@lru_cache
def get_settings() -> Settings:
    return Settings()
