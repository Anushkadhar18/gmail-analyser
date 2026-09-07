import React, { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE } from '../lib/theme'

const SUGGESTIONS = [
  'reply to the most recent email saying thanks, all good',
  "schedule a sync with alice@example.com tomorrow at 3pm",
  'what can you help me with?',
]

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8L14.5 1.5L9.5 14.5L7 8.5L1.5 8Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
      <path d="M8 0L9.4 6.6L16 8L9.4 9.4L8 16L6.6 9.4L0 8L6.6 6.6L8 0Z" />
    </svg>
  )
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', height: 14 }}>
      <span className="dot" style={{ animationDelay: '0ms' }} />
      <span className="dot" style={{ animationDelay: '150ms' }} />
      <span className="dot" style={{ animationDelay: '300ms' }} />
      <style jsx>{`
        .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${PALETTE.muted};
          animation: bounce 1.1s infinite ease-in-out;
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </span>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`
    }
  }, [input])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending])

  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text, at: Date.now() }])
    setSending(true)
    try {
      const res = await apiFetch('/api/chat/message', { method: 'POST', body: JSON.stringify({ message: text }) })
      setMessages((m) => [...m, { role: 'assistant', text: res.reply_text, intent: res.intent, proposedEvent: res.proposed_event, draftId: res.draft_id, at: Date.now() }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `Something went wrong: ${e.message}`, isError: true, at: Date.now() }])
    } finally {
      setSending(false)
    }
  }

  const confirmSchedule = async (event, index) => {
    try {
      await apiFetch('/mcp/calendar/create_event', { method: 'POST', body: JSON.stringify({ event, approve: true }) })
      setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, scheduled: true } : msg)))
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `Failed to schedule: ${e.message}`, isError: true, at: Date.now() }])
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <Layout maxWidth={680}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 30, margin: 0, letterSpacing: '-0.01em' }}>Assistant</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: PALETTE.success, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: PALETTE.success, display: 'inline-block' }} />
            online
          </span>
        </div>
        <p style={{ color: PALETTE.muted, fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
          Drafts replies and proposes meetings from your Gmail and Calendar. Nothing sends without your review.
        </p>
      </div>

      <div
          style={{
            background: PALETTE.panel,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(31,36,34,0.04), 0 8px 24px rgba(31,36,34,0.05)',
          }}
        >
          <div ref={scrollRef} style={{ height: 420, overflowY: 'auto', padding: '20px 20px 8px' }}>
            {messages.length === 0 && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: PALETTE.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SparkIcon />
                </div>
                <p style={{ color: PALETTE.muted, fontSize: 14, textAlign: 'center', maxWidth: 320, margin: 0 }}>
                  Try one of these, or write your own below.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 420 }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="suggestion"
                      style={{
                        textAlign: 'left',
                        background: PALETTE.bg,
                        border: `1px solid ${PALETTE.border}`,
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 13.5,
                        color: PALETTE.text,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 16, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: m.role === 'user' ? PALETTE.borderStrong : PALETTE.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  {m.role === 'user' ? (
                    <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>You</span>
                  ) : (
                    <SparkIcon />
                  )}
                </div>
                <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      background: m.isError ? '#FBEDE7' : m.role === 'user' ? PALETTE.userBubble : PALETTE.assistantBubble,
                      color: m.isError ? PALETTE.danger : m.role === 'user' ? PALETTE.userText : PALETTE.text,
                      borderRadius: 14,
                      borderTopRightRadius: m.role === 'user' ? 4 : 14,
                      borderTopLeftRadius: m.role === 'user' ? 14 : 4,
                      padding: '10px 14px',
                      fontSize: 14.5,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.text}
                  </div>

                  {m.intent === 'schedule' && m.proposedEvent && !m.scheduled && (
                    <div
                      style={{
                        marginTop: 8,
                        border: `1px solid ${PALETTE.border}`,
                        borderRadius: 12,
                        padding: 12,
                        width: '100%',
                        background: PALETTE.bg,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                        Proposed event
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{m.proposedEvent.summary}</div>
                      <div style={{ fontSize: 13, color: PALETTE.muted, marginBottom: 10 }}>
                        {m.proposedEvent.start?.dateTime} → {m.proposedEvent.end?.dateTime}
                      </div>
                      <button
                        onClick={() => confirmSchedule(m.proposedEvent, i)}
                        className="cta"
                        style={{
                          background: PALETTE.accent,
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Confirm &amp; schedule
                      </button>
                    </div>
                  )}
                  {m.scheduled && (
                    <p style={{ color: PALETTE.success, fontSize: 12.5, fontWeight: 600, margin: '6px 0 0' }}>✓ Added to your calendar</p>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: PALETTE.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SparkIcon />
                </div>
                <div style={{ background: PALETTE.assistantBubble, borderRadius: 14, borderTopLeftRadius: 4, padding: '12px 14px' }}>
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${PALETTE.border}`, padding: 12, display: 'flex', gap: 8, alignItems: 'flex-end', background: PALETTE.panel }}>
            <textarea
              ref={textareaRef}
              autoFocus
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a message — Enter to send, Shift+Enter for a new line"
              style={{
                flex: 1,
                resize: 'none',
                padding: '10px 14px',
                fontSize: 14.5,
                fontFamily: 'var(--font-body)',
                color: PALETTE.text,
                border: `1.5px solid ${PALETTE.border}`,
                borderRadius: 10,
                outline: 'none',
                lineHeight: 1.4,
                maxHeight: 140,
              }}
              className="composer"
            />
            <button
              onClick={() => send()}
              disabled={sending || !input.trim()}
              className="send-btn"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: 'none',
                background: sending || !input.trim() ? PALETTE.border : PALETTE.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: sending || !input.trim() ? 'default' : 'pointer',
                flexShrink: 0,
              }}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </div>

      <style jsx>{`
        .suggestion:hover {
          border-color: ${PALETTE.accent} !important;
          background: ${PALETTE.userBubble} !important;
        }
        .composer:focus {
          border-color: ${PALETTE.accent} !important;
        }
        .cta:hover {
          background: ${PALETTE.accentDark} !important;
        }
        .send-btn:not(:disabled):hover {
          background: ${PALETTE.accentDark} !important;
        }
      `}</style>
    </Layout>
  )
}
