import os
import requests
import json

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def generate_draft_from_context(subject: str | None, context: str) -> str:
    """Generate a draft body using an LLM. Falls back to a simple template if no key provided."""
    if OPENAI_API_KEY:
        # Use OpenAI's Chat Completions (simple HTTP call)
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
        system = "You are an assistant that drafts professional email replies. Keep it concise and include a suggested subject if missing."
        prompt = f"Context:\n{context}\n\nDraft a polite reply email."
        if subject:
            prompt = f"Subject: {subject}\n\n" + prompt
        data = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            "max_tokens": 512,
        }
        resp = requests.post(url, headers=headers, data=json.dumps(data), timeout=15)
        resp.raise_for_status()
        j = resp.json()
        try:
            return j["choices"][0]["message"]["content"]
        except Exception:
            return """
Hello,

Thanks for your message. I'll follow up shortly.

Best regards,
"""
    # Fallback simple template
    subj_line = f"Re: {subject}\n\n" if subject else "\n"
    return f"Hello,\n\nThank you for your message. I'll review and get back to you shortly.\n\nBest regards,\n"
