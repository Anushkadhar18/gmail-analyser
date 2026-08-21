from services.backend.app.ai.task_extractor import extract_tasks_from_text


def test_extract_simple_request():
    text = "Please send the report by Friday. Also, can you review the budget?"
    tasks = extract_tasks_from_text(text)
    assert isinstance(tasks, list)
    assert any("report" in t.get("description", "").lower() for t in tasks) or len(tasks) >= 1


def test_extract_fallback_heuristic():
    text = "Hi,\n\nCan you approve the PR by next Monday?\n\nThanks"
    tasks = extract_tasks_from_text(text)
    assert isinstance(tasks, list)
    assert any("approve" in t.get("description", "").lower() for t in tasks)
