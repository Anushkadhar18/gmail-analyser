import json
from services.backend.app.ai.meeting_brief import generate_meeting_brief


def main():
    event = {
        "summary": "Local Smoke Test Meeting",
        "start": {"dateTime": "2026-08-17T10:00:00Z"},
        "end": {"dateTime": "2026-08-17T11:00:00Z"},
        "description": "Smoke test event for meeting brief generation",
    }
    related = [{"snippet": "Please prepare a short summary of Q2 results and action items."}]
    brief_text, structured = generate_meeting_brief(event, related)
    print("=== Brief Text ===")
    print(brief_text)
    print("\n=== Structured ===")
    print(json.dumps(structured, indent=2))


if __name__ == "__main__":
    main()
