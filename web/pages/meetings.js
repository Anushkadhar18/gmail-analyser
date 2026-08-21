import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function MeetingsPage() {
  const [briefs, setBriefs] = useState([])
  const [eventId, setEventId] = useState('')

  const load = () => {
    apiFetch('/api/meetings/list').then(setBriefs).catch(() => setBriefs([]))
  }

  useEffect(load, [])

  const requestBrief = async () => {
    if (!eventId) return
    await apiFetch('/api/meetings/brief', { method: 'POST', body: JSON.stringify({ event_id: eventId, async_generate: true }) })
    setEventId('')
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Meeting Briefs</h2>
      <div style={{ marginBottom: 16 }}>
        <input placeholder="Calendar event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} />
        <button onClick={requestBrief} style={{ marginLeft: 8 }}>Generate brief</button>
        <button onClick={load} style={{ marginLeft: 8 }}>Refresh list</button>
      </div>
      {briefs.length === 0 && <p>No briefs yet</p>}
      <ul>
        {briefs.map(b => (
          <li key={b.id} style={{ marginBottom: 16, whiteSpace: 'pre-wrap' }}>
            <strong>Event: {b.event_id}</strong>
            <p>{b.brief}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
