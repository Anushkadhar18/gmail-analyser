import os
import requests
import json
from typing import List, Dict

GROQ_API_KEY = os.getenv("GROQ_API_KEY")


def _llm_extract_tasks(text: str) -> List[Dict]:
    if not GROQ_API_KEY:
        return []
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    system = "You are an assistant that extracts actionable tasks from email content. For each task return a JSON object with fields: description, due_date (ISO or null), action_required (short label). Return only JSON array."
    prompt = f"Email content:\n{text}\n\nExtract tasks as JSON array."
    data = {"model": "llama-3.3-70b-versatile", "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}], "max_tokens": 512}
    try:
        resp = requests.post(url, headers=headers, data=json.dumps(data), timeout=15)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        tasks = json.loads(content)
        if isinstance(tasks, list):
            return tasks
    except Exception:
        return []
    return []


def extract_tasks_from_text(text: str) -> List[Dict]:
    # Try LLM first
    tasks = _llm_extract_tasks(text)
    if tasks:
        return tasks

    # Fallback heuristic: look for lines with verbs and dates
    results = []
    lines = text.splitlines()
    for ln in lines:
        ln_strip = ln.strip()
        if not ln_strip:
            continue
        if ln_strip.lower().startswith("please") or "by" in ln_strip.lower() or ln_strip.endswith("?"):
            results.append({"description": ln_strip, "due_date": None, "action_required": "respond"})
    return results
