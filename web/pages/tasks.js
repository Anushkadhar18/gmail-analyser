import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle, primaryButtonStyle, secondaryButtonStyle, inputStyle } from '../lib/theme'

function dueInfo(dueDate) {
  if (!dueDate) return { label: null, group: 'none', urgency: 'none' }
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return { label: null, group: 'none', urgency: 'none' }

  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayDiff = Math.round((startOfDay(due) - startOfDay(now)) / 86400000)

  const timeLabel = due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const dateLabel = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  if (dayDiff < 0) {
    const days = Math.abs(dayDiff)
    return { label: `Overdue by ${days} day${days === 1 ? '' : 's'}`, group: 'overdue', urgency: 'overdue' }
  }
  if (dayDiff === 0) return { label: `Today, ${timeLabel}`, group: 'today', urgency: 'today' }
  if (dayDiff === 1) return { label: `Tomorrow, ${timeLabel}`, group: 'soon', urgency: 'soon' }
  if (dayDiff <= 6) return { label: due.toLocaleDateString(undefined, { weekday: 'long' }), group: 'soon', urgency: 'soon' }
  return { label: dateLabel, group: 'later', urgency: 'normal' }
}

const URGENCY_COLOR = {
  overdue: PALETTE.danger,
  today: PALETTE.warning,
  soon: PALETTE.warning,
  normal: PALETTE.muted,
  none: PALETTE.muted,
}

const GROUPS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'soon', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No due date' },
]

function gmailLink(messageId) {
  return `https://mail.google.com/mail/u/0/#all/${messageId}`
}

function StarIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill={filled ? PALETTE.warning : 'none'} stroke={filled ? PALETTE.warning : PALETTE.muted} strokeWidth="1.5">
      <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" strokeLinejoin="round" />
    </svg>
  )
}

function Checkbox({ checked, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={checked ? 'Mark not done' : 'Mark done'}
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: `2px solid ${checked ? PALETTE.success : PALETTE.border}`,
        background: checked ? PALETTE.success : 'transparent',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M2 8l4 4 8-8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

export default function TasksPage() {
  const [allTasks, setAllTasks] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [hideCompleted, setHideCompleted] = useState(false)
  const [query, setQuery] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newImportant, setNewImportant] = useState(false)
  const [adding, setAdding] = useState(false)
  const descriptionRef = useRef(null)

  const [notesOpenId, setNotesOpenId] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const [showEmailPicker, setShowEmailPicker] = useState(false)
  const [emails, setEmails] = useState([])
  const [emailsLoaded, setEmailsLoaded] = useState(false)
  const [findingId, setFindingId] = useState(null)
  const [foundCounts, setFoundCounts] = useState({})

  const load = () => {
    apiFetch('/api/tasks/list?include_completed=true').then(setAllTasks).catch(() => setAllTasks([]))
  }

  useEffect(load, [])

  // "n" focuses the add-task box, unless already typing somewhere
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'n' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        descriptionRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const complete = async (id, completed) => {
    setBusyId(id)
    try {
      await apiFetch('/api/tasks/complete', { method: 'POST', body: JSON.stringify({ task_id: id, completed }) })
      setAllTasks((t) => t.map((x) => (x.id === id ? { ...x, completed } : x)))
    } finally {
      setBusyId(null)
    }
  }

  const toggleImportant = async (t) => {
    setAllTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, important: !x.important } : x)))
    try {
      await apiFetch('/api/tasks/update', { method: 'POST', body: JSON.stringify({ task_id: t.id, important: !t.important }) })
    } catch {
      setAllTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, important: t.important } : x)))
    }
  }

  const deleteTask = async (id) => {
    setBusyId(id)
    try {
      await apiFetch('/api/tasks/delete', { method: 'POST', body: JSON.stringify({ task_id: id }) })
      setAllTasks((t) => t.filter((x) => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  const openNotes = (t) => {
    setNotesOpenId(notesOpenId === t.id ? null : t.id)
    setNotesDraft(t.notes || '')
  }

  const saveNotes = async (id) => {
    setSavingNotes(true)
    try {
      await apiFetch('/api/tasks/update', { method: 'POST', body: JSON.stringify({ task_id: id, notes: notesDraft }) })
      setAllTasks((t) => t.map((x) => (x.id === id ? { ...x, notes: notesDraft } : x)))
      setNotesOpenId(null)
    } finally {
      setSavingNotes(false)
    }
  }

  const addTask = async () => {
    if (!newDescription.trim()) return
    setAdding(true)
    try {
      const body = { description: newDescription.trim(), important: newImportant }
      if (newDueDate) body.due_date = new Date(newDueDate).toISOString()
      const task = await apiFetch('/api/tasks/create', { method: 'POST', body: JSON.stringify(body) })
      setAllTasks((t) => [task, ...t])
      setNewDescription('')
      setNewDueDate('')
      setNewImportant(false)
    } finally {
      setAdding(false)
    }
  }

  const openEmailPicker = () => {
    setShowEmailPicker(true)
    if (!emailsLoaded) {
      apiFetch('/mcp/gmail/search_emails', { method: 'POST', body: JSON.stringify({ query: 'in:inbox newer_than:14d', max_results: 6 }) })
        .then(async (res) => {
          const ids = (res.results || []).map((r) => r.id)
          const msgs = await Promise.all(
            ids.map((id) => apiFetch('/mcp/gmail/get_email', { method: 'POST', body: JSON.stringify({ id }) }).catch(() => null))
          )
          setEmails(msgs.filter(Boolean))
        })
        .catch(() => setEmails([]))
        .finally(() => setEmailsLoaded(true))
    }
  }

  const findTasksIn = async (msg) => {
    setFindingId(msg.id)
    try {
      const j = await apiFetch('/api/tasks/extract', { method: 'POST', body: JSON.stringify({ message_id: msg.id }) })
      setFoundCounts((c) => ({ ...c, [msg.id]: j.extracted.length }))
      if (j.extracted.length > 0) load()
    } finally {
      setFindingId(null)
    }
  }

  const openTasks = useMemo(() => allTasks.filter((t) => !t.completed), [allTasks])
  const completedTasks = useMemo(() => allTasks.filter((t) => t.completed), [allTasks])
  const overdueCount = useMemo(() => openTasks.filter((t) => dueInfo(t.due_date).group === 'overdue').length, [openTasks])

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    let base = hideCompleted ? openTasks : allTasks
    if (q) base = base.filter((t) => t.description.toLowerCase().includes(q))
    const byGroup = {}
    for (const g of GROUPS) byGroup[g.key] = []
    for (const t of base) byGroup[dueInfo(t.due_date).group].push(t)
    for (const key of Object.keys(byGroup)) {
      byGroup[key].sort((a, b) => {
        // Done tasks sink to the bottom of their group but stay visible —
        // only Delete removes a task from view, completing it doesn't.
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        if (a.important !== b.important) return a.important ? -1 : 1
        if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date)
        return 0
      })
    }
    return byGroup
  }, [allTasks, openTasks, hideCompleted, query])

  const visibleCount = useMemo(() => Object.values(grouped).reduce((n, arr) => n + arr.length, 0), [grouped])

  const total = allTasks.length
  const progressPct = total === 0 ? 0 : Math.round((completedTasks.length / total) * 100)

  const renderTask = (t) => {
    const { label, urgency } = dueInfo(t.due_date)
    const notesOpen = notesOpenId === t.id
    return (
      <div key={t.id} style={{ ...cardStyle, padding: '14px 18px', opacity: t.completed ? 0.55 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ marginTop: 1 }}>
            <Checkbox checked={t.completed} disabled={busyId === t.id} onClick={() => complete(t.id, !t.completed)} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, lineHeight: 1.5, textDecoration: t.completed ? 'line-through' : 'none' }}>
              {t.description}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              {label && <span style={{ fontSize: 12, fontWeight: 600, color: URGENCY_COLOR[urgency] }}>{label}</span>}
              {t.action_required && (
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: PALETTE.muted, background: PALETTE.assistantBubble, padding: '2px 8px', borderRadius: 999 }}>
                  {t.action_required}
                </span>
              )}
              {t.source_message_id && (
                <a href={gmailLink(t.source_message_id)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: PALETTE.accent, fontWeight: 600, textDecoration: 'none' }}>
                  Open in Gmail ↗
                </a>
              )}
              <button onClick={() => openNotes(t)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: PALETTE.muted, fontWeight: 600 }}>
                {t.notes ? 'Edit note' : '+ Add note'}
              </button>
            </div>
            {!notesOpen && t.notes && (
              <div style={{ fontSize: 12.5, color: PALETTE.muted, marginTop: 6, fontStyle: 'italic' }}>{t.notes}</div>
            )}
            {notesOpen && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <input
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveNotes(t.id)}
                  placeholder="Add a short note…"
                  style={{ ...inputStyle, fontSize: 13, padding: '6px 10px', flex: 1 }}
                  autoFocus
                />
                <button onClick={() => saveNotes(t.id)} disabled={savingNotes} style={{ ...primaryButtonStyle, fontSize: 12, padding: '6px 12px' }}>
                  Save
                </button>
              </div>
            )}
          </div>
          <button onClick={() => toggleImportant(t)} aria-label="Toggle important" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', flexShrink: 0 }}>
            <StarIcon filled={t.important} />
          </button>
          <button onClick={() => deleteTask(t.id)} disabled={busyId === t.id} style={{ ...secondaryButtonStyle, flexShrink: 0, fontSize: 12.5, padding: '6px 12px', color: PALETTE.muted }}>
            {busyId === t.id ? '…' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <Layout title="Tasks" subtitle="Found automatically every 5 minutes, or add your own below.">
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {completedTasks.length} of {total} done
            {overdueCount > 0 && <span style={{ color: PALETTE.danger, fontWeight: 700 }}> · {overdueCount} overdue</span>}
          </div>
          <div style={{ fontSize: 12, color: PALETTE.muted }}>{progressPct}%</div>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: PALETTE.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: PALETTE.success, borderRadius: 999, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
          Add a task <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(press "n" to jump here)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setNewImportant((v) => !v)}
            aria-label="Mark new task important"
            style={{ background: 'none', border: `1.5px solid ${PALETTE.border}`, borderRadius: 9, width: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <StarIcon filled={newImportant} />
          </button>
          <input
            ref={descriptionRef}
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

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <button
          onClick={() => (showEmailPicker ? setShowEmailPicker(false) : openEmailPicker())}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left' }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: PALETTE.accent, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {showEmailPicker ? '▾' : '▸'} Find tasks in a recent email
          </span>
        </button>

        {showEmailPicker && (
          <div style={{ marginTop: 12 }}>
            {!emailsLoaded && <p style={{ color: PALETTE.muted, fontSize: 13.5, margin: 0 }}>Loading recent inbox mail…</p>}
            {emailsLoaded && emails.length === 0 && <p style={{ color: PALETTE.muted, fontSize: 13.5, margin: 0 }}>No recent inbox mail found.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {emails.map((msg) => {
                const found = foundCounts[msg.id]
                return (
                  <div key={msg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: `1px solid ${PALETTE.border}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{msg.subject || '(no subject)'}</div>
                      <div style={{ color: PALETTE.muted, fontSize: 12 }}>{msg.from}</div>
                    </div>
                    <button
                      onClick={() => findTasksIn(msg)}
                      disabled={findingId === msg.id}
                      style={{ ...secondaryButtonStyle, flexShrink: 0, fontSize: 12.5, padding: '6px 12px', opacity: findingId === msg.id ? 0.6 : 1 }}
                    >
                      {findingId === msg.id ? 'Reading…' : found === undefined ? 'Find tasks' : found === 0 ? 'None found' : `Found ${found} ✓`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Filter tasks…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...inputStyle, maxWidth: 260 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: PALETTE.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
          Hide completed
        </label>
      </div>

      {visibleCount === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: PALETTE.muted, fontSize: 14, marginBottom: 16 }}>
          {allTasks.length === 0 ? "Nothing here yet." : 'Nothing matches that filter.'}
        </div>
      )}

      {GROUPS.map((g) =>
        grouped[g.key].length > 0 ? (
          <div key={g.key} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              {g.label} <span style={{ fontWeight: 400 }}>({grouped[g.key].length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{grouped[g.key].map(renderTask)}</div>
          </div>
        ) : null
      )}
    </Layout>
  )
}
