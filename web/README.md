# Underwriting Agent demo (Next.js + shadcn)

Demo of agentic underwriting for any kind of lending: auto-decide inside the envelope, escalate the rest with a cited trace, and keep a hard-coded risk ceiling.

Preset: shadcn `b3avGgdsgM` (Next, RTL-capable components, pointer cursors). Default UI direction is **LTR** (`lang=en`) for the English underwriting product; `components.json` keeps `"rtl": true` so added components stay RTL-ready.

## Setup

```bash
cd web
pnpm install
cp .env.example .env.local   # optional
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

For Admin live status / ingest, also run the Python API:

```bash
# from repo root
uv run underwriting-api
```

## Routes

| Path | Purpose |
|------|---------|
| `/` | Hub |
| `/admin` | RAG status + ingest (calls `/admin/rag/*`) |
| `/playground` | Overview + sidebar |
| `/playground/rag` | Policy RAG search, or streaming generate chat |
| `/playground/underwrite` | Applicant → agent stub |

## Env

| Variable | Default | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8080` | FastAPI base URL |
| `NEXT_PUBLIC_ADMIN_API_KEY` | _(empty)_ | Sent as `X-Admin-Key` when set |
