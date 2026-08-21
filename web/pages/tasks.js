import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function TasksPage() {
  const [tasks, setTasks] = useState([])

  const load = () => {
    apiFetch('/api/tasks/list').then(setTasks).catch(() => setTasks([]))
  }

  useEffect(load, [])

  const complete = async (id) => {
    await apiFetch('/api/tasks/complete', { method: 'POST', body: JSON.stringify({ task_id: id, completed: true }) })
    setTasks(tasks.filter(t => t.id !== id))
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Tasks</h2>
      {tasks.length === 0 && <p>No open tasks</p>}
      <ul>
        {tasks.map(t => (
          <li key={t.id} style={{ marginBottom: 12 }}>
            <span>{t.description}</span>
            {t.due_date && <span> (due {t.due_date})</span>}
            <button style={{ marginLeft: 12 }} onClick={() => complete(t.id)}>Mark done</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
