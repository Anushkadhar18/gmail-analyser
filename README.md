# Gmail & Calendar Assistant

A FastAPI backend + Celery worker that connects to a user's Gmail and Calendar
via OAuth, drafts email replies, extracts action items from email into tasks,
and generates meeting briefs. A Next.js frontend provides a minimal UI.

## Components

- `services/backend` — FastAPI app: OAuth, Gmail/Calendar wrappers, MCP-style
  routers (`/mcp/gmail`, `/mcp/calendar`), and the drafts/tasks/approvals/
  meetings APIs. Session auth via a signed httpOnly cookie set after OAuth.
- `services/worker` — Celery worker + beat. Runs periodic Gmail sync (every 5
  min) and token refresh (every 30 min), plus on-demand tasks (draft sending,
  meeting brief generation).
- `web` — Next.js frontend (pages: connect, drafts, extract, tasks,
  approvals, meetings).
- `infra/docker` — Docker Compose for local dev (Postgres, Redis, backend,
  worker, web).

## Setup

1. Copy `.env.example` to `.env` at the repo root and fill in:
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from a Google Cloud OAuth
     client (type "Web application"), with `http://localhost:8000/auth/callback`
     as an authorized redirect URI.
   - `TOKEN_ENCRYPTION_KEY` — generate with:
     `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
   - `SECRET_KEY` — any random string; used to sign session cookies.
   - `OPENAI_API_KEY` — optional. Without it, draft/task/brief generation
     falls back to simple templates/heuristics instead of LLM calls.

2. Copy `web/.env.local.example` to `web/.env.local` (defaults are fine for
   local dev).

3. From `infra/docker`:

   ```bash
   docker compose up --build
   ```

   - Backend: `http://localhost:8000` (docs at `/docs`)
   - Frontend: `http://localhost:3000`

4. Run database migrations (from `services/backend`, with `DATABASE_URL`
   pointing at the running Postgres container):

   ```bash
   cd services/backend
   alembic upgrade head
   ```

5. Open `http://localhost:3000` and click "Connect Google" to complete the
   OAuth flow. This sets a session cookie tied to your account — every
   subsequent request infers the user from that cookie rather than trusting a
   client-supplied `user_id`.

## Running tests

```bash
python -m venv .venv
.venv/Scripts/activate  # or `source .venv/bin/activate` on macOS/Linux
pip install -r services/backend/requirements.txt
pytest
```

## Notes

- The Celery worker runs both the worker and beat scheduler in one process
  (`celery worker --beat`), which is fine for local dev but should be split
  into separate `worker` and `beat` processes for production.
- Sending email, creating/updating calendar events, and running the
  background email sync all require valid OAuth credentials for the target
  user; approval-gated actions (`send`, `create_event`, `update_event`)
  explicitly require `approve`/`approve_send` to be set.
