import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, secondaryButtonStyle, inputStyle } from '../lib/theme'

export default function MeetingsPage() {
  const [briefs, setBriefs] = useState([])
  const [eventId, setEventId] = useState('')
  const [requesting, setRequesting] = useState(false)

  const load = () => {
    apiFetch('/api/meetings/list').then(setBriefs).catch(() => setBriefs([]))
  }

  useEffect(load, [])

  const requestBrief = async () => {
    if (!eventId) return
    setRequesting(true)
    try {
      await apiFetch('/api/meetings/brief', { method: 'POST', body: JSON.stringify({ event_id: eventId, async_generate: true }) })
      setEventId('')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <Layout title="Meeting Briefs" subtitle="Generate a summary and suggested talking points from a calendar event, plus any related email threads.">
      <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Calendar event ID"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <button onClick={requestBrief} disabled={requesting || !eventId} style={{ ...primaryButtonStyle, opacity: requesting || !eventId ? 0.6 : 1 }}>
          {requesting ? 'Generating…' : 'Generate brief'}
        </button>
        <button onClick={load} style={secondaryButtonStyle}>Refresh</button>
      </div>

      {briefs.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>No briefs yet.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {briefs.map((b) => (
          <div key={b.id} style={cardStyle}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 8, color: PALETTE.muted }}>
              Event: {b.event_id}
            </div>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{b.brief}</p>
          </div>
        ))}
      </div>
    </Layout>
  )
}
