import React, { useState } from 'react'
import { apiFetch } from '../lib/api'

export default function ExtractPage() {
  const [threadId, setThreadId] = useState('')
  const [messageId, setMessageId] = useState('')
  const [result, setResult] = useState(null)

  const submit = async () => {
    const body = {}
    if (threadId) body.thread_id = threadId
    if (messageId) body.message_id = messageId
    const j = await apiFetch('/api/tasks/extract', { method: 'POST', body: JSON.stringify(body) })
    setResult(j)
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Extract Tasks</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Thread ID</label>
        <input value={threadId} onChange={(e) => setThreadId(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Message ID</label>
        <input value={messageId} onChange={(e) => setMessageId(e.target.value)} style={{ width: '100%' }} />
      </div>
      <button onClick={submit}>Extract</button>

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Extracted</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
