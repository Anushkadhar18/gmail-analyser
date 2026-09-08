import React, { useEffect, useState } from 'react'
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

  const [showEvents, setShowEvents] = useState(false)
  const [events, setEvents] = useState([])
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const [requestingId, setRequestingId] = useState(null)
  const [queuedIds, setQueuedIds] = useState([])

  const [showManual, setShowManual] = useState(false)
  const [eventId, setEventId] = useState('')
  const [manualRequesting, setManualRequesting] = useState(false)

  const loadBriefs = () => {
    apiFetch('/api/meetings/list').then(setBriefs).catch(() => setBriefs([]))
  }

  useEffect(loadBriefs, [])

  const openEventPicker = () => {
    setShowEvents(true)
    if (!eventsLoaded) {
      apiFetch('/mcp/calendar/get_events', { method: 'POST', body: JSON.stringify({ time_min: new Date().toISOString() }) })
        .then((res) => setEvents(res.events || []))
        .catch(() => setEvents([]))
        .finally(() => setEventsLoaded(true))
    }
  }

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
    <Layout title="Meeting Briefs" subtitle="Generate a summary and talking points from a calendar event, plus any related email threads.">
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <button
          onClick={() => (showEvents ? setShowEvents(false) : openEventPicker())}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left' }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: PALETTE.accent, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {showEvents ? '▾' : '▸'} Pick from upcoming events
          </span>
        </button>

        {showEvents && (
          <div style={{ marginTop: 12 }}>
            {!eventsLoaded && <p style={{ color: PALETTE.muted, fontSize: 13.5, margin: 0 }}>Loading your calendar…</p>}
            {eventsLoaded && events.length === 0 && (
              <p style={{ color: PALETTE.muted, fontSize: 13.5, margin: 0 }}>
                No upcoming events found. Schedule one via Chat first, then come back here.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: `1px solid ${PALETTE.border}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{ev.summary || '(no title)'}</div>
                    <div style={{ color: PALETTE.muted, fontSize: 12 }}>{formatEventTime(ev)}</div>
                  </div>
                  <button
                    onClick={() => generateFor(ev.id)}
                    disabled={requestingId === ev.id || queuedIds.includes(ev.id)}
                    style={{ ...secondaryButtonStyle, flexShrink: 0, fontSize: 12.5, padding: '6px 12px', opacity: requestingId === ev.id ? 0.6 : 1 }}
                  >
                    {requestingId === ev.id ? 'Queuing…' : queuedIds.includes(ev.id) ? 'Queued ✓' : 'Generate brief'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
