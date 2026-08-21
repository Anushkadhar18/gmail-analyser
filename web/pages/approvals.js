import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function ApprovalsPage() {
  const [items, setItems] = useState([])

  const load = () => {
    apiFetch('/api/approvals/pending').then(setItems).catch(() => setItems([]))
  }

  useEffect(load, [])

  const review = async (id, approve) => {
    await apiFetch('/api/approvals/review', { method: 'POST', body: JSON.stringify({ approval_id: id, approve }) })
    setItems(items.filter(i => i.id !== id))
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Pending Approvals</h2>
      {items.length === 0 && <p>Nothing pending</p>}
      <ul>
        {items.map(i => (
          <li key={i.id} style={{ marginBottom: 12 }}>
            <div>{i.reason || `draft ${i.draft_id || ''} event ${i.event_id || ''}`}</div>
            <button onClick={() => review(i.id, true)}>Approve</button>
            <button style={{ marginLeft: 8 }} onClick={() => review(i.id, false)}>Reject</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
