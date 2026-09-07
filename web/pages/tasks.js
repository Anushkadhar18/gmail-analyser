import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, secondaryButtonStyle } from '../lib/theme'

export default function TasksPage() {
  const [tasks, setTasks] = useState([])
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    apiFetch('/api/tasks/list').then(setTasks).catch(() => setTasks([]))
  }

  useEffect(load, [])

  const complete = async (id) => {
    setBusyId(id)
    try {
      await apiFetch('/api/tasks/complete', { method: 'POST', body: JSON.stringify({ task_id: id, completed: true }) })
      setTasks((t) => t.filter((x) => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Layout title="Tasks" subtitle="Action items automatically extracted from your inbox by the background sync, or on demand from the Extract Tasks page.">
      {tasks.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>No open tasks.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.map((t) => (
          <div key={t.id} style={{ ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              {t.description}
              {t.due_date && <span style={{ color: PALETTE.muted, fontSize: 12.5 }}> — due {t.due_date}</span>}
            </div>
            <button onClick={() => complete(t.id)} disabled={busyId === t.id} style={{ ...secondaryButtonStyle, flexShrink: 0 }}>
              {busyId === t.id ? 'Marking…' : 'Mark done'}
            </button>
          </div>
        ))}
      </div>
    </Layout>
  )
}
