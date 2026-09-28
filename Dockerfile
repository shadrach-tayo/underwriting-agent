# Production API image (LangGraph underwriting service).
# Build:  docker build -t underwriting-api .
# Run:    docker run --rm -p 8080:8080 --env-file .env underwriting-api

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.6.14 /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock README.md ./
COPY src ./src
# data/ is gitignored; docker build uses the local tree (gold set, policy PDFs).
COPY data ./data

RUN uv sync --frozen --no-dev

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

# Disable reload in containers; bind all interfaces.
ENV API_HOST=0.0.0.0 \
    API_PORT=8080 \
    API_RELOAD=false

CMD ["uvicorn", "http_api:app", "--host", "0.0.0.0", "--port", "8080"]
