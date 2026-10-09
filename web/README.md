# Underwriting Agent demo (Next.js + shadcn)

Demo of agentic underwriting for any kind of lending: auto-decide inside the envelope, escalate the rest with a cited trace, and keep a hard-coded risk ceiling.

shadcn/ui on Next.js. Default UI direction is **LTR** (`lang=en`); `components.json` keeps `"rtl": true` so added components stay RTL-ready.

## Setup

```bash
cd web
pnpm install
cp .env.example .env.local   # optional
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). **Walk through a case** on the landing page runs Cedar Ridge (`gold-001`) from apply → portal → desk → HITL.

For underwrite, gold-set samples, and Ask AI, also run the Python API:

```bash
# from repo root
uv run underwriting-api
```

Admin ingest stays behind `NEXT_PUBLIC_SHOW_ADMIN`.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing — walkthrough, Ask AI, desk / apply entry |
| `/apply` | Applicant intake (gold-set samples, Ask AI dock) |
| `/portal` | Applicant status for the open case |
| `/playground/underwrite` | Officer desk — one file or the gold-set catalog |
| `/playground` | Redirects to `/playground/underwrite` |
| `/playground/rag` | Policy RAG search / chat (also in the Ask AI sheet) |
| `/admin` | RAG status + ingest (`/admin/rag/*`), hidden unless the admin flag is on |

## Env

| Variable | Default | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8080` | FastAPI base URL |
| `NEXT_PUBLIC_ADMIN_API_KEY` | _(empty)_ | Sent as `X-Admin-Key` when set |
| `NEXT_PUBLIC_SHOW_ADMIN` | _(off)_ | `1` / `true` / `yes` shows Admin in the header and enables `/admin` |
