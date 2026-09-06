import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { API_BASE, apiFetch } from '../lib/api'

export default function Home() {
  const [user, setUser] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    apiFetch('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecked(true))
  }, [])

  const startOAuth = () => {
    window.location.href = `${API_BASE}/auth/start`
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Gmail & Calendar Assistant</h1>
      {!checked && <p>Loading...</p>}
      {checked && !user && (
        <>
          <p>Connect your Google account to get started.</p>
          <button onClick={startOAuth} style={{ padding: '8px 16px' }}>
            Connect Google
          </button>
        </>
      )}
      {checked && user && (
        <>
          <p>Connected as {user.email}</p>
          <nav style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            <Link href="/chat">Chat</Link>
            <Link href="/drafts">Drafts</Link>
            <Link href="/extract">Extract Tasks</Link>
            <Link href="/tasks">Tasks</Link>
            <Link href="/approvals">Approvals</Link>
            <Link href="/meetings">Meeting Briefs</Link>
          </nav>
        </>
      )}
    </div>
  )
}
