import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, secondaryButtonStyle, dangerButtonStyle, inputStyle, statusPillStyle } from '../lib/theme'

export default function Drafts() {
  const [drafts, setDrafts] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)

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

  const reject = async (id) => {
    setBusyId(id)
    try {
      await apiFetch('/api/drafts/reject', { method: 'POST', body: JSON.stringify({ draft_id: id }) })
      setDrafts((d) => d.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)))
    } finally {
      setBusyId(null)
    }
  }

  const deleteDraft = async (id) => {
    setBusyId(id)
    try {
      await apiFetch('/api/drafts/delete', { method: 'POST', body: JSON.stringify({ draft_id: id }) })
      setDrafts((d) => d.filter((x) => x.id !== id))
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

  const startEdit = (d) => {
    setEditingId(d.id)
    setEditSubject(d.subject || '')
    setEditBody(d.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id) => {
    setSaving(true)
    try {
      const updated = await apiFetch('/api/drafts/update', {
        method: 'POST',
        body: JSON.stringify({ draft_id: id, subject: editSubject, body: editBody }),
      })
      setDrafts((d) => d.map((x) => (x.id === id ? { ...x, subject: updated.subject, body: updated.body, status: updated.status } : x)))
      setEditingId(null)
    } finally {
      setSaving(false)
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
        {drafts.map((d) => {
          const isEditing = editingId === d.id
          const canEdit = d.status === 'pending' || d.status === 'approved'

          return (
            <div key={d.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                {isEditing ? (
                  <input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Subject"
                    style={{ ...inputStyle, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, flex: 1 }}
                  />
                ) : (
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>{d.subject || 'No subject'}</div>
                )}
                <span style={statusPillStyle(d.status)}>{d.status}</span>
              </div>

              {isEditing ? (
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={8}
                  style={{ ...inputStyle, fontSize: 14, lineHeight: 1.6, resize: 'vertical', marginBottom: 12 }}
                />
              ) : (
                <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: PALETTE.text, margin: '0 0 14px' }}>{d.body}</p>
              )}

              {d.status === 'approved' && isEditing && (
                <p style={{ fontSize: 12, color: PALETTE.warning, margin: '-6px 0 12px' }}>
                  Saving will move this back to "pending" — you'll need to approve it again.
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {isEditing ? (
                  <>
                    <button onClick={() => saveEdit(d.id)} disabled={saving || !editBody.trim()} style={{ ...primaryButtonStyle, opacity: saving || !editBody.trim() ? 0.6 : 1 }}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={cancelEdit} disabled={saving} style={secondaryButtonStyle}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
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
                    {canEdit && (
                      <button onClick={() => startEdit(d)} style={secondaryButtonStyle}>
                        Edit
                      </button>
                    )}
                    {(d.status === 'pending' || d.status === 'approved') && (
                      <button onClick={() => reject(d.id)} disabled={busyId === d.id} style={dangerButtonStyle}>
                        Reject
                      </button>
                    )}
                    {d.status === 'queued' && (
                      <span style={{ fontSize: 12.5, color: PALETTE.muted }}>On its way — no further action needed.</span>
                    )}
                    {d.status === 'sent' && (
                      <span style={{ fontSize: 12.5, color: PALETTE.muted, marginRight: 4 }}>Sent.</span>
                    )}
                    {d.status === 'rejected' && (
                      <span style={{ fontSize: 12.5, color: PALETTE.muted, marginRight: 4 }}>Dismissed.</span>
                    )}
                    {d.status !== 'queued' && (
                      <button onClick={() => deleteDraft(d.id)} disabled={busyId === d.id} style={{ ...secondaryButtonStyle, color: PALETTE.muted }}>
                        {busyId === d.id ? '…' : 'Delete'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
