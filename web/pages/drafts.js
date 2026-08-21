import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function Drafts() {
  const [drafts, setDrafts] = useState([])

  useEffect(() => {
    apiFetch('/api/drafts/list').then(setDrafts).catch(() => setDrafts([]))
  }, [])

  const approve = async (id) => {
    await apiFetch('/api/drafts/approve', { method: 'POST', body: JSON.stringify({ draft_id: id }) })
    setDrafts(drafts.map(d => d.id === id ? { ...d, status: 'approved' } : d))
  }

  const send = async (id) => {
    await apiFetch('/api/drafts/send', { method: 'POST', body: JSON.stringify({ draft_id: id }) })
    setDrafts(drafts.map(d => d.id === id ? { ...d, status: 'queued' } : d))
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Drafts</h2>
      {drafts.length === 0 && <p>No drafts</p>}
      <ul>
        {drafts.map(d => (
          <li key={d.id} style={{ marginBottom: 16 }}>
            <strong>{d.subject || 'No subject'}</strong>
            <p>{d.body}</p>
            <p>Status: {d.status}</p>
            {d.status === 'pending' && <button onClick={() => approve(d.id)}>Approve</button>}
            {d.status === 'approved' && <button onClick={() => send(d.id)}>Send</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}
