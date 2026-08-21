meeting_brief_schema = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "agenda": {"type": "array", "items": {"type": "string"}},
        "attendees": {"type": "array", "items": {"type": "string"}},
        "key_points": {"type": "array", "items": {"type": "string"}},
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "owner": {"type": ["string", "null"]},
                    "due_date": {"type": ["string", "null"]},
                },
                "required": ["description"],
            },
        },
    },
    "required": ["summary"],
}
