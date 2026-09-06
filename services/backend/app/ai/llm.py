import os
import requests
import json

GROQ_API_KEY = os.getenv("GROQ_API_KEY")


def _fallback_template() -> str:
    return "Hello,\n\nThank you for your message. I'll review and get back to you shortly.\n\nBest regards,\n"


def generate_draft_from_context(subject: str | None, context: str) -> str:
    """Generate a draft body using an LLM. Falls back to a simple template if no
    key is provided, or if the LLM call fails for any reason (invalid key,
    network error, malformed response) so a bad GROQ_API_KEY degrades
    gracefully instead of crashing the caller.
    """
    if GROQ_API_KEY:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
            system = "You are an assistant that drafts professional email replies. Keep it concise and include a suggested subject if missing."
            prompt = f"Context:\n{context}\n\nDraft a polite reply email."
            if subject:
                prompt = f"Subject: {subject}\n\n" + prompt
            data = {
                "model": "openai/gpt-oss-120b",
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                "max_tokens": 512,
                # gpt-oss is a reasoning model that spends tokens on a hidden
                # "reasoning" field before the actual answer; without this,
                # max_tokens can run out mid-reasoning and leave content empty.
                "reasoning_effort": "low",
            }
            resp = requests.post(url, headers=headers, data=json.dumps(data), timeout=15)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return content or _fallback_template()
        except Exception:
            return _fallback_template()
    return _fallback_template()
