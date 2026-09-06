import React, { useState } from 'react'
import { apiFetch } from '../lib/api'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setSending(true)
    try {
      const res = await apiFetch('/api/chat/message', { method: 'POST', body: JSON.stringify({ message: text }) })
      setMessages((m) => [...m, { role: 'assistant', text: res.reply_text, intent: res.intent, proposedEvent: res.proposed_event, draftId: res.draft_id }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${e.message}` }])
    } finally {
      setSending(false)
    }
  }

  const confirmSchedule = async (event, index) => {
    try {
      await apiFetch('/mcp/calendar/create_event', { method: 'POST', body: JSON.stringify({ event, approve: true }) })
      setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, scheduled: true } : msg)))
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `Failed to schedule: ${e.message}` }])
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h2>Chat</h2>
      <p style={{ color: '#666' }}>
        Ask it to draft a reply (e.g. "reply saying I'll be there") or propose a meeting
        (e.g. "schedule a sync with alice@example.com tomorrow at 3pm").
      </p>

      <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, minHeight: 240, marginBottom: 12 }}>
        {messages.length === 0 && <p style={{ color: '#999' }}>No messages yet</p>}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <div
              style={{
                display: 'inline-block',
                background: m.role === 'user' ? '#e6f0ff' : '#f2f2f2',
                borderRadius: 6,
                padding: '8px 12px',
                maxWidth: '90%',
                whiteSpace: 'pre-wrap',
                textAlign: 'left',
              }}
            >
              {m.text}
            </div>
            {m.intent === 'schedule' && m.proposedEvent && !m.scheduled && (
              <div style={{ marginTop: 6 }}>
                <button onClick={() => confirmSchedule(m.proposedEvent, i)}>Confirm &amp; Schedule</button>
              </div>
            )}
            {m.scheduled && <p style={{ color: 'green', margin: '4px 0 0' }}>Scheduled.</p>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={send} disabled={sending}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
