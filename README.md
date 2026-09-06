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
- `backend/` — a separate, standalone script (`main.py`), unrelated to
  `services/backend`. A minimal FastAPI app with a single
  `gmail.readonly`-scoped OAuth flow (`InstalledAppFlow`, credentials cached
  in a local `token.json`) and one endpoint, `GET /gmail/messages`, that
  returns the 10 most recent messages. No session auth, no database, no
  write scopes — useful for a quick "can I read this account's Gmail at all"
  check without standing up the full stack.

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

## Standalone Gmail test script (`backend/`)

Independent of everything above — no Docker, no Postgres/Redis, no session
auth. Useful for a quick sanity check that OAuth + the Gmail API work at all
for a given account.

1. In [Google Cloud Console](https://console.cloud.google.com/), create an
   OAuth client of type **Desktop app**, download it, and save it as
   `backend/client_secret.json` (gitignored — never commit this file).
2. From `backend/`:
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8010
   ```
3. `GET http://localhost:8010/auth/google` — opens a local browser window to
   complete consent; caches credentials in `backend/token.json` (also
   gitignored).
4. `GET http://localhost:8010/gmail/messages` — returns the 10 most recent
   messages (sender, subject, date, body, thread ID) as JSON.

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
