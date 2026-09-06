import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function Drafts() {
  const [drafts, setDrafts] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)

  const load = () => {
    apiFetch('/api/drafts/list').then(setDrafts).catch(() => setDrafts([]))
  }

  useEffect(load, [])

  const approve = async (id) => {
    await apiFetch('/api/drafts/approve', { method: 'POST', body: JSON.stringify({ draft_id: id }) })
    setDrafts(drafts.map(d => d.id === id ? { ...d, status: 'approved' } : d))
  }

  const send = async (id) => {
    await apiFetch('/api/drafts/send', { method: 'POST', body: JSON.stringify({ draft_id: id }) })
    setDrafts(drafts.map(d => d.id === id ? { ...d, status: 'queued' } : d))
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
    <div style={{ padding: 24 }}>
      <h2>Drafts</h2>

      <div style={{ marginBottom: 16 }}>
        <button onClick={scanInbox} disabled={scanning}>
          {scanning ? 'Scanning inbox...' : 'Draft replies for recent inbox emails'}
        </button>
        <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
          Scans the last 7 days of inbox mail and drafts a reply for each real,
          not-yet-drafted thread. Automated/no-reply/mailing-list senders are
          skipped automatically. Nothing is sent — every draft still needs
          Approve then Send below.
        </p>
        {scanResult && !scanResult.error && (
          <p style={{ fontSize: 13 }}>
            Created {scanResult.created.length}, skipped {scanResult.skipped.length}.
          </p>
        )}
        {scanResult && scanResult.error && (
          <p style={{ color: 'crimson', fontSize: 13 }}>Error: {scanResult.error}</p>
        )}
      </div>

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
