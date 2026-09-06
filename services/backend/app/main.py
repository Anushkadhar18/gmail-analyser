from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import auth
from .mcp import gmail_mcp, calendar_mcp
from .api import drafts
from .api import tasks as tasks_api
from .api import approvals as approvals_api
from .api import meetings as meetings_api
from .api import chat as chat_api

app = FastAPI(title="Gmail Calendar Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.WEB_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(gmail_mcp.router, prefix="/mcp/gmail", tags=["mcp-gmail"])
app.include_router(calendar_mcp.router, prefix="/mcp/calendar", tags=["mcp-calendar"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["drafts"])
app.include_router(tasks_api.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(approvals_api.router, prefix="/api/approvals", tags=["approvals"])
app.include_router(meetings_api.router, prefix="/api/meetings", tags=["meetings"])
app.include_router(chat_api.router, prefix="/api/chat", tags=["chat"])


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("services.backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
