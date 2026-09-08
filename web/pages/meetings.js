import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, secondaryButtonStyle, inputStyle } from '../lib/theme'

function formatEventTime(ev) {
  const start = ev.start?.dateTime || ev.start?.date
  if (!start) return ''
  const d = new Date(start)
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MeetingsPage() {
  const [briefs, setBriefs] = useState([])
  const [events, setEvents] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [requestingId, setRequestingId] = useState(null)
  const [queuedIds, setQueuedIds] = useState([])

  const [showManual, setShowManual] = useState(false)
  const [eventId, setEventId] = useState('')
  const [manualRequesting, setManualRequesting] = useState(false)

  const loadBriefs = () => {
    apiFetch('/api/meetings/list').then(setBriefs).catch(() => setBriefs([]))
  }

  const loadEvents = () => {
    setLoadingEvents(true)
    apiFetch('/mcp/calendar/get_events', { method: 'POST', body: JSON.stringify({ time_min: new Date().toISOString() }) })
      .then((res) => setEvents(res.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false))
  }

  useEffect(() => {
    loadBriefs()
    loadEvents()
  }, [])

  const generateFor = async (id) => {
    setRequestingId(id)
    try {
      await apiFetch('/api/meetings/brief', { method: 'POST', body: JSON.stringify({ event_id: id, async_generate: true }) })
      setQueuedIds((q) => [...q, id])
    } finally {
      setRequestingId(null)
    }
  }

  const submitManual = async () => {
    if (!eventId) return
    setManualRequesting(true)
    try {
      await apiFetch('/api/meetings/brief', { method: 'POST', body: JSON.stringify({ event_id: eventId, async_generate: true }) })
      setEventId('')
    } finally {
      setManualRequesting(false)
    }
  }

  return (
    <Layout title="Meeting Briefs" subtitle="Pick an upcoming event below to generate a summary and talking points — no need to find an event ID.">
      {loadingEvents && <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>Loading your calendar…</div>}

      {!loadingEvents && events.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>
          No upcoming events found. Schedule one via{' '}
          <Link href="/chat" style={{ color: PALETTE.accent, fontWeight: 600 }}>Chat</Link> first, then come back here.
        </div>
      )}

      {events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {events.map((ev) => (
            <div key={ev.id} style={{ ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{ev.summary || '(no title)'}</div>
                <div style={{ color: PALETTE.muted, fontSize: 12.5, marginTop: 2 }}>{formatEventTime(ev)}</div>
              </div>
              <button
                onClick={() => generateFor(ev.id)}
                disabled={requestingId === ev.id || queuedIds.includes(ev.id)}
                style={{ ...secondaryButtonStyle, flexShrink: 0, opacity: requestingId === ev.id ? 0.6 : 1 }}
              >
                {requestingId === ev.id ? 'Queuing…' : queuedIds.includes(ev.id) ? 'Queued ✓' : 'Generate brief'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={loadBriefs} style={secondaryButtonStyle}>Refresh briefs</button>
        <button onClick={() => setShowManual((s) => !s)} style={secondaryButtonStyle}>
          {showManual ? 'Hide advanced options' : 'Advanced: paste an event ID'}
        </button>
      </div>

      {showManual && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <p style={{ fontSize: 12.5, color: PALETTE.muted, marginTop: 0 }}>
            Only needed for an event not shown above (e.g. on a different calendar). Open the event in Google
            Calendar, use the "..." menu → Copy link, and take the id from the URL.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              placeholder="Calendar event ID"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            />
            <button onClick={submitManual} disabled={manualRequesting || !eventId} style={{ ...primaryButtonStyle, opacity: manualRequesting || !eventId ? 0.6 : 1 }}>
              {manualRequesting ? 'Generating…' : 'Generate brief'}
            </button>
          </div>
        </div>
      )}

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
