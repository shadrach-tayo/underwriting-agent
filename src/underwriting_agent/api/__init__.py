"""FastAPI service wrapping the underwriting graph (Week 4)."""

from fastapi import FastAPI

from underwriting_agent import __version__

app = FastAPI(
    title="Underwriting Decision & Escalation Agent",
    version=__version__,
    description="Auto-decide within a confidence/risk envelope; escalate everything else.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"status": "ready"}
