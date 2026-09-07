import React, { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, secondaryButtonStyle, inputStyle } from '../lib/theme'

function dueInfo(dueDate) {
  if (!dueDate) return { label: null, urgency: 'none' }
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return { label: null, urgency: 'none' }

  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayDiff = Math.round((startOfDay(due) - startOfDay(now)) / 86400000)

  const timeLabel = due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const dateLabel = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  if (dayDiff < 0) {
    const days = Math.abs(dayDiff)
    return { label: `Overdue by ${days} day${days === 1 ? '' : 's'}`, urgency: 'overdue' }
  }
  if (dayDiff === 0) return { label: `Due today, ${timeLabel}`, urgency: 'today' }
  if (dayDiff === 1) return { label: `Due tomorrow, ${timeLabel}`, urgency: 'soon' }
  if (dayDiff <= 6) return { label: `Due ${due.toLocaleDateString(undefined, { weekday: 'long' })}`, urgency: 'soon' }
  return { label: `Due ${dateLabel}`, urgency: 'normal' }
}

const URGENCY_COLOR = {
  overdue: PALETTE.danger,
  today: PALETTE.warning,
  soon: PALETTE.warning,
  normal: PALETTE.muted,
  none: PALETTE.muted,
}

function gmailLink(messageId) {
  return `https://mail.google.com/mail/u/0/#all/${messageId}`
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [query, setQuery] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [adding, setAdding] = useState(false)

  const load = (includeCompleted) => {
    apiFetch(`/api/tasks/list?include_completed=${includeCompleted}`).then(setTasks).catch(() => setTasks([]))
  }

  useEffect(() => load(showCompleted), [showCompleted])

  const complete = async (id, completed) => {
    setBusyId(id)
    try {
      await apiFetch('/api/tasks/complete', { method: 'POST', body: JSON.stringify({ task_id: id, completed }) })
      if (!showCompleted && completed) {
        setTasks((t) => t.filter((x) => x.id !== id))
      } else {
        setTasks((t) => t.map((x) => (x.id === id ? { ...x, completed } : x)))
      }
    } finally {
      setBusyId(null)
    }
  }

  const addTask = async () => {
    if (!newDescription.trim()) return
    setAdding(true)
    try {
      const body = { description: newDescription.trim() }
      if (newDueDate) body.due_date = new Date(newDueDate).toISOString()
      const task = await apiFetch('/api/tasks/create', { method: 'POST', body: JSON.stringify(body) })
      setTasks((t) => [task, ...t])
      setNewDescription('')
      setNewDueDate('')
    } finally {
      setAdding(false)
    }
  }

  const visible = useMemo(() => {
    const filtered = query.trim()
      ? tasks.filter((t) => t.description.toLowerCase().includes(query.trim().toLowerCase()))
      : tasks

    const rank = { overdue: 0, today: 1, soon: 2, normal: 3, none: 4 }
    return [...filtered].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      const ra = rank[dueInfo(a.due_date).urgency]
      const rb = rank[dueInfo(b.due_date).urgency]
      if (ra !== rb) return ra - rb
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date)
      return 0
    })
  }, [tasks, query])

  const openCount = tasks.filter((t) => !t.completed).length
  const overdueCount = tasks.filter((t) => !t.completed && dueInfo(t.due_date).urgency === 'overdue').length

  return (
    <Layout
      title="Tasks"
      subtitle={
        overdueCount > 0
          ? `${openCount} open, ${overdueCount} overdue — extracted from your inbox automatically, or added by hand below.`
          : `${openCount} open — extracted from your inbox automatically, or added by hand below.`
      }
    >
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
          Add a task
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="e.g. Reply to Priya about the deck"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            style={{ ...inputStyle, flex: '1 1 260px' }}
          />
          <input
            type="datetime-local"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            style={{ ...inputStyle, width: 200, flex: '0 0 auto' }}
          />
          <button onClick={addTask} disabled={adding || !newDescription.trim()} style={{ ...primaryButtonStyle, opacity: adding || !newDescription.trim() ? 0.6 : 1 }}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Filter tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle, maxWidth: 260 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: PALETTE.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
          Show completed
        </label>
      </div>

      {visible.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14 }}>
          {tasks.length === 0 ? 'No open tasks.' : 'Nothing matches that filter.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((t) => {
          const { label, urgency } = dueInfo(t.due_date)
          return (
            <div
              key={t.id}
              style={{
                ...cardStyle,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                opacity: t.completed ? 0.6 : 1,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, lineHeight: 1.5, textDecoration: t.completed ? 'line-through' : 'none' }}>
                  {t.description}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {label && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: URGENCY_COLOR[urgency] }}>{label}</span>
                  )}
                  {t.action_required && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        color: PALETTE.muted,
                        background: PALETTE.assistantBubble,
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}
                    >
                      {t.action_required}
                    </span>
                  )}
                  {t.source_message_id && (
                    <a
                      href={gmailLink(t.source_message_id)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: PALETTE.accent, fontWeight: 600, textDecoration: 'none' }}
                    >
                      Open in Gmail ↗
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => complete(t.id, !t.completed)}
                disabled={busyId === t.id}
                style={{ ...secondaryButtonStyle, flexShrink: 0 }}
              >
                {busyId === t.id ? '…' : t.completed ? 'Reopen' : 'Mark done'}
              </button>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
