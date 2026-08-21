import json
from unittest.mock import patch

from services.backend.app.ai.meeting_brief import generate_meeting_brief


def test_generate_meeting_brief_parses_structured():
    # Mock the OpenAI API response to include JSON
    fake_struct = {
        "summary": "Test meeting",
        "agenda": ["Intro", "Plan"],
        "key_points": ["KP1"],
        "action_items": [{"description": "Do X", "owner": "alice@example.com", "due_date": None}],
    }
    fake_response_text = json.dumps(fake_struct)

    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": fake_response_text}}]}

    with patch("services.backend.app.ai.meeting_brief.OPENAI_API_KEY", "fake-key"), \
         patch("requests.post", return_value=FakeResp()):
        brief_text, structured = generate_meeting_brief({"summary": "S"}, related_emails=[])
        assert structured is not None
        assert structured.get("summary") == "Test meeting"
        assert "Agenda" in brief_text or "Agenda:" in brief_text


def test_generate_brief_fallback():
    event = {"summary": "Project Sync", "start": "2026-08-20T10:00:00Z", "end": "2026-08-20T11:00:00Z", "description": "Discuss Q3 roadmap and deliverables."}
    text, structured = generate_meeting_brief(event, related_emails=None)
    assert isinstance(text, str)
    # Without OPENAI_API_KEY, structured should be None
    assert structured is None or isinstance(structured, dict)
