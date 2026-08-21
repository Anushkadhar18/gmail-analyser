from typing import List
from datetime import datetime, timedelta, timezone
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


class CalendarService:
    def __init__(self, credentials: Credentials):
        self.creds = credentials
        self.service = build("calendar", "v3", credentials=self.creds, cache_discovery=False)

    def get_events(self, calendar_id: str = "primary", time_min: str | None = None) -> List[dict]:
        params = {"calendarId": calendar_id, "singleEvents": True, "orderBy": "startTime"}
        if time_min:
            params["timeMin"] = time_min
        resp = self.service.events().list(**params).execute()
        return resp.get("items", [])

    def find_free_slots(self, duration_minutes: int = 30, window_days: int = 7) -> List[dict]:
        """Return free slots of at least `duration_minutes` within the next `window_days`,
        computed as the gaps between the primary calendar's busy blocks.

        Real implementation would also consider working hours and multiple attendees'
        calendars; this only looks at the primary calendar's freebusy data.
        """
        now = datetime.now(timezone.utc)
        time_min = now.isoformat()
        time_max = (now + timedelta(days=window_days)).isoformat()
        body = {"timeMin": time_min, "timeMax": time_max, "items": [{"id": "primary"}]}
        resp = self.service.freebusy().query(body=body).execute()
        busy = resp.get("calendars", {}).get("primary", {}).get("busy", [])

        busy_ranges = sorted(
            (
                (datetime.fromisoformat(b["start"].replace("Z", "+00:00")), datetime.fromisoformat(b["end"].replace("Z", "+00:00")))
                for b in busy
            ),
            key=lambda r: r[0],
        )

        duration = timedelta(minutes=duration_minutes)
        window_end = now + timedelta(days=window_days)
        free_slots = []
        cursor = now

        for start, end in busy_ranges:
            if start > cursor and (start - cursor) >= duration:
                free_slots.append({"start": cursor.isoformat(), "end": start.isoformat()})
            if end > cursor:
                cursor = end

        if window_end > cursor and (window_end - cursor) >= duration:
            free_slots.append({"start": cursor.isoformat(), "end": window_end.isoformat()})

        return free_slots
