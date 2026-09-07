import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, statusPillStyle } from '../lib/theme'

export default function Drafts() {
  const [drafts, setDrafts] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    apiFetch('/api/drafts/list').then(setDrafts).catch(() => setDrafts([]))
  }

  useEffect(load, [])

  const approve = async (id) => {
    setBusyId(id)
    try {
      await apiFetch('/api/drafts/approve', { method: 'POST', body: JSON.stringify({ draft_id: id }) })
      setDrafts((d) => d.map((x) => (x.id === id ? { ...x, status: 'approved' } : x)))
    } finally {
      setBusyId(null)
    }
  }

  const send = async (id) => {
    setBusyId(id)
    try {
      await apiFetch('/api/drafts/send', { method: 'POST', body: JSON.stringify({ draft_id: id }) })
      setDrafts((d) => d.map((x) => (x.id === id ? { ...x, status: 'queued' } : x)))
    } finally {
      setBusyId(null)
    }
  }

  const scanInbox = async () => {
    setScanning(true)
    setScanResult(null)
    try {
      const res = await apiFetch('/api/drafts/batch_generate', { method: 'POST', body: JSON.stringify({}) })
      setScanResult(res)
      load()
    } catch (e) {
      setScanResult({ error: e.message })
    } finally {
      setScanning(false)
    }
  }

  return (
    <Layout title="Drafts" subtitle="A background sync already does this every 5 minutes on its own — this button just runs it now.">
      <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 3 }}>Scan recent inbox mail</div>
          <div style={{ color: PALETTE.muted, fontSize: 13, lineHeight: 1.5, maxWidth: 480 }}>
            Drafts a reply for each real, not-yet-drafted thread from the last 7 days. Automated senders and
            emails that don't need a reply are skipped automatically. Nothing is sent.
          </div>
          {scanResult && !scanResult.error && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: PALETTE.success, fontWeight: 600 }}>
              Created {scanResult.created.length}, skipped {scanResult.skipped.length}.
            </div>
          )}
          {scanResult && scanResult.error && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: PALETTE.danger, fontWeight: 600 }}>Error: {scanResult.error}</div>
          )}
        </div>
        <button onClick={scanInbox} disabled={scanning} style={{ ...primaryButtonStyle, opacity: scanning ? 0.6 : 1, flexShrink: 0 }}>
          {scanning ? 'Scanning…' : 'Draft replies now'}
        </button>
      </div>

      {drafts.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>No drafts yet.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {drafts.map((d) => (
          <div key={d.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>{d.subject || 'No subject'}</div>
              <span style={statusPillStyle(d.status)}>{d.status}</span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: PALETTE.text, margin: '0 0 14px' }}>{d.body}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {d.status === 'pending' && (
                <button onClick={() => approve(d.id)} disabled={busyId === d.id} style={primaryButtonStyle}>
                  {busyId === d.id ? 'Approving…' : 'Approve'}
                </button>
              )}
              {d.status === 'approved' && (
                <button onClick={() => send(d.id)} disabled={busyId === d.id} style={primaryButtonStyle}>
                  {busyId === d.id ? 'Sending…' : 'Send'}
                </button>
              )}
              {(d.status === 'queued' || d.status === 'sent') && (
                <span style={{ fontSize: 12.5, color: PALETTE.muted }}>On its way — no further action needed.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
