import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, secondaryButtonStyle, inputStyle } from '../lib/theme'

export default function ExtractPage() {
  const [emails, setEmails] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [extractingId, setExtractingId] = useState(null)
  const [results, setResults] = useState({})

  const [showManual, setShowManual] = useState(false)
  const [threadId, setThreadId] = useState('')
  const [messageId, setMessageId] = useState('')
  const [manualResult, setManualResult] = useState(null)
  const [manualLoading, setManualLoading] = useState(false)

  useEffect(() => {
    apiFetch('/mcp/gmail/search_emails', { method: 'POST', body: JSON.stringify({ query: 'in:inbox newer_than:14d', max_results: 8 }) })
      .then(async (res) => {
        const ids = (res.results || []).map((r) => r.id)
        const msgs = await Promise.all(
          ids.map((id) => apiFetch('/mcp/gmail/get_email', { method: 'POST', body: JSON.stringify({ id }) }).catch(() => null))
        )
        setEmails(msgs.filter(Boolean))
      })
      .catch(() => setEmails([]))
      .finally(() => setLoadingList(false))
  }, [])

  const extractFor = async (msg) => {
    setExtractingId(msg.id)
    try {
      const j = await apiFetch('/api/tasks/extract', { method: 'POST', body: JSON.stringify({ message_id: msg.id }) })
      setResults((r) => ({ ...r, [msg.id]: j }))
    } finally {
      setExtractingId(null)
    }
  }

  const submitManual = async () => {
    const body = {}
    if (threadId) body.thread_id = threadId
    if (messageId) body.message_id = messageId
    setManualLoading(true)
    try {
      const j = await apiFetch('/api/tasks/extract', { method: 'POST', body: JSON.stringify(body) })
      setManualResult(j)
    } finally {
      setManualLoading(false)
    }
  }

  return (
    <Layout
      title="Extract Tasks"
      subtitle="Pick a recent email below and pull action items out of it — no need to find or paste an ID."
    >
      {loadingList && <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>Loading recent inbox mail…</div>}

      {!loadingList && emails.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>
          No recent inbox mail found in the last 14 days.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {emails.map((msg) => {
          const result = results[msg.id]
          return (
            <div key={msg.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{msg.subject || '(no subject)'}</div>
                  <div style={{ color: PALETTE.muted, fontSize: 12.5, marginTop: 2 }}>{msg.from}</div>
                </div>
                <button
                  onClick={() => extractFor(msg)}
                  disabled={extractingId === msg.id}
                  style={{ ...secondaryButtonStyle, flexShrink: 0, opacity: extractingId === msg.id ? 0.6 : 1 }}
                >
                  {extractingId === msg.id ? 'Extracting…' : result ? 'Extract again' : 'Extract tasks'}
                </button>
              </div>

              {result && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${PALETTE.border}` }}>
                  {result.extracted.length === 0 ? (
                    <p style={{ fontSize: 13, color: PALETTE.muted, margin: 0 }}>No action items found in this email.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {result.extracted.map((t) => (
                        <li key={t.id} style={{ fontSize: 13.5, marginBottom: 4 }}>
                          {t.description}
                          {t.due_date && <span style={{ color: PALETTE.muted }}> — due {t.due_date}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p style={{ fontSize: 12, color: PALETTE.muted, margin: '8px 0 0' }}>Saved — check the Tasks page.</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={() => setShowManual((s) => !s)} style={{ ...secondaryButtonStyle, marginTop: 20 }}>
        {showManual ? 'Hide advanced options' : 'Advanced: paste an ID manually'}
      </button>

      {showManual && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <p style={{ fontSize: 12.5, color: PALETTE.muted, marginTop: 0 }}>
            Only needed for a thread not shown above. Find an ID from the URL when viewing the email in Gmail —
            the string after <code>#inbox/</code> or <code>#all/</code> in the address bar — or from the "Open in
            Gmail" link on any task on the Tasks page.
          </p>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
            Thread ID
          </label>
          <input value={threadId} onChange={(e) => setThreadId(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
            Message ID
          </label>
          <input value={messageId} onChange={(e) => setMessageId(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />

          <button onClick={submitManual} disabled={manualLoading || (!threadId && !messageId)} style={{ ...primaryButtonStyle, opacity: manualLoading || (!threadId && !messageId) ? 0.6 : 1 }}>
            {manualLoading ? 'Extracting…' : 'Extract'}
          </button>

          {manualResult && (
            <pre style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: PALETTE.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {JSON.stringify(manualResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </Layout>
  )
}
