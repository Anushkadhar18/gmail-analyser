import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, dangerButtonStyle } from '../lib/theme'

export default function ApprovalsPage() {
  const [items, setItems] = useState([])
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    apiFetch('/api/approvals/pending').then(setItems).catch(() => setItems([]))
  }

  useEffect(load, [])

  const review = async (id, approve) => {
    setBusyId(id)
    try {
      await apiFetch('/api/approvals/review', { method: 'POST', body: JSON.stringify({ approval_id: id, approve }) })
      setItems((i) => i.filter((x) => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Layout title="Approvals" subtitle="Anything queued here needs your explicit sign-off before it goes any further.">
      {items.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>Nothing pending.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((i) => (
          <div key={i.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14 }}>{i.reason || `draft ${i.draft_id || ''} event ${i.event_id || ''}`}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => review(i.id, true)} disabled={busyId === i.id} style={primaryButtonStyle}>
                Approve
              </button>
              <button onClick={() => review(i.id, false)} disabled={busyId === i.id} style={dangerButtonStyle}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
