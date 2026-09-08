import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, dangerButtonStyle } from '../lib/theme'

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState([])
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    apiFetch('/api/drafts/list')
      .then((all) => setDrafts(all.filter((d) => d.status === 'pending')))
      .catch(() => setDrafts([]))
  }

  useEffect(load, [])

  const respond = async (id, endpoint) => {
    setBusyId(id)
    try {
      await apiFetch(`/api/drafts/${endpoint}`, { method: 'POST', body: JSON.stringify({ draft_id: id }) })
      setDrafts((d) => d.filter((x) => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Layout
      title="Approvals"
      subtitle="Every drafted reply waiting on your decision, in one place. Approve queues it for sending; Reject dismisses it. Need to change the wording first? Edit it on the Drafts page."
    >
      {drafts.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>
          Nothing waiting on you right now.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {drafts.map((d) => (
          <div key={d.id} style={cardStyle}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
              {d.subject || 'No subject'}
            </div>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: PALETTE.text, margin: '0 0 14px' }}>{d.body}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => respond(d.id, 'approve')} disabled={busyId === d.id} style={primaryButtonStyle}>
                {busyId === d.id ? 'Working…' : 'Approve'}
              </button>
              <button onClick={() => respond(d.id, 'reject')} disabled={busyId === d.id} style={dangerButtonStyle}>
                Reject
              </button>
              <Link href="/drafts" style={{ fontSize: 12.5, color: PALETTE.muted, marginLeft: 4 }}>
                Edit first →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
