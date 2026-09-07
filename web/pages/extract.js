import React, { useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, inputStyle } from '../lib/theme'

export default function ExtractPage() {
  const [threadId, setThreadId] = useState('')
  const [messageId, setMessageId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const body = {}
    if (threadId) body.thread_id = threadId
    if (messageId) body.message_id = messageId
    setLoading(true)
    try {
      const j = await apiFetch('/api/tasks/extract', { method: 'POST', body: JSON.stringify(body) })
      setResult(j)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Extract Tasks" subtitle="Pull action items out of one specific thread or message, instead of waiting for the background sync.">
      <div style={cardStyle}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
          Thread ID
        </label>
        <input value={threadId} onChange={(e) => setThreadId(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
          Message ID
        </label>
        <input value={messageId} onChange={(e) => setMessageId(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />

        <button onClick={submit} disabled={loading || (!threadId && !messageId)} style={{ ...primaryButtonStyle, opacity: loading || (!threadId && !messageId) ? 0.6 : 1 }}>
          {loading ? 'Extracting…' : 'Extract'}
        </button>
      </div>

      {result && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Extracted</div>
          <pre style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: PALETTE.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </Layout>
  )
}
