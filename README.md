# Gmail & Calendar Assistant

A FastAPI backend + Celery worker that connects to a user's Gmail and Calendar
via OAuth, drafts email replies, extracts action items from email into tasks,
and generates meeting briefs. A Next.js frontend provides a minimal UI.

## Components

- `services/backend` — FastAPI app: OAuth, Gmail/Calendar wrappers, MCP-style
  routers (`/mcp/gmail`, `/mcp/calendar`), and the drafts/tasks/approvals/
  meetings APIs. Session auth via a signed httpOnly cookie set after OAuth.
- `services/worker` — Celery worker + beat. Runs periodic Gmail sync (every 5
  min, `fetch_emails_task`) — extracts tasks **and** auto-drafts replies for
  real, not-yet-drafted threads (see "Chat and selective auto-drafting"
  below) — and token refresh (every 30 min), plus on-demand tasks (draft
  sending, meeting brief generation).
- `web` — Next.js frontend (pages: connect, chat, drafts, extract, tasks,
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
   - `GROQ_API_KEY` — optional, free tier at https://console.groq.com/keys.
     Without it (or if it fails for any reason), draft/task/brief generation
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

## Chat and selective auto-drafting

- `POST /api/chat/message` (frontend: `/chat`) — a small LLM-routed chat
  endpoint. "Reply"-style messages create a pending `Draft`; if the message
  says "recent"/"latest"/"last email"/"newest" it drafts against that
  specific message's real thread/content rather than a generic template.
  "Schedule"-style messages return a proposed calendar event for the
  frontend to confirm (via the existing, approval-gated
  `/mcp/calendar/create_event`) — nothing is created until confirmed.
- `POST /api/drafts/batch_generate` (frontend: a button on `/drafts`) — the
  on-demand version of the same logic the worker runs automatically (below):
  scans the inbox (default: last 7 days) and drafts a reply for every real,
  not-yet-drafted thread.
- **Fully automated drafting**: `fetch_emails_task` (worker, every 5
  minutes) does this without any button click — for each new message it
  both extracts tasks *and*, if the message's thread doesn't have a draft
  yet, drafts a reply. Selective by design
  (`app/services/email_filters.py`): skips senders matching a
  no-reply/notification pattern, and skips anything carrying a
  `List-Unsubscribe` header (the standard signal for mailing-list/marketing
  mail), so it won't draft replies to notifications or newsletters. Safe to
  run repeatedly — dedup is by `Task.source_message_id` and
  `Draft.thread_id`, so nothing is ever re-extracted or re-drafted.
- Every drafting path — chat, the manual batch button, and the automatic
  worker sync — only ever creates `Draft` rows with `status="pending"`.
  Nothing is ever sent automatically; every draft still requires a human to
  go through `/api/drafts/approve` → `/api/drafts/send` (or the equivalent
  buttons on `/drafts`).
- All LLM calls (`app/ai/llm.py`, `task_extractor.py`, `meeting_brief.py`,
  `chat.py`) go through Groq's OpenAI-compatible API
  (`https://api.groq.com/openai/v1/chat/completions`, model
  `openai/gpt-oss-120b` with `reasoning_effort: "low"` — gpt-oss is a
  reasoning model that would otherwise burn its token budget on hidden
  chain-of-thought before writing the actual reply) and fall back to a
  template/heuristic if `GROQ_API_KEY` is unset **or** if the call fails for
  any reason (invalid key, network error, malformed response, empty
  content) — a bad key degrades draft quality, it doesn't crash the
  request.

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
