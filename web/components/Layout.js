import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { API_BASE, apiFetch } from '../lib/api'
import { PALETTE } from '../lib/theme'

const NAV_ITEMS = [
  { href: '/chat', label: 'Chat' },
  { href: '/drafts', label: 'Drafts' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/meetings', label: 'Meeting Briefs' },
]

export default function Layout({ title, subtitle, children, maxWidth = 780 }) {
  const [user, setUser] = useState(null)
  const [checked, setChecked] = useState(false)
  const router = useRouter()

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
    <div style={{ minHeight: '100vh', background: PALETTE.bg, fontFamily: 'var(--font-body)', color: PALETTE.text }}>
      <header
        style={{
          borderBottom: `1px solid ${PALETTE.border}`,
          background: PALETTE.panel,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, color: PALETTE.text }}>
              GmailAnalyser
            </span>
          </Link>
          {checked && user && (
            <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {NAV_ITEMS.map((item) => {
                const active = router.pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      textDecoration: 'none',
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: active ? 'white' : PALETTE.muted,
                      background: active ? PALETTE.accent : 'transparent',
                      padding: '6px 11px',
                      borderRadius: 7,
                    }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        <div style={{ fontSize: 13 }}>
          {!checked && <span style={{ color: PALETTE.muted }}>Loading…</span>}
          {checked && user && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: PALETTE.muted }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: PALETTE.success, display: 'inline-block' }} />
              {user.email}
            </span>
          )}
          {checked && !user && (
            <button onClick={startOAuth} style={{
              background: PALETTE.accent, color: 'white', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              Connect Google
            </button>
          )}
        </div>
      </header>

      <main style={{ padding: '32px 24px' }}>
        <div style={{ maxWidth, margin: '0 auto' }}>
          {(title || subtitle) && (
            <div style={{ marginBottom: 24 }}>
              {title && (
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>
                  {title}
                </h1>
              )}
              {subtitle && <p style={{ color: PALETTE.muted, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 560 }}>{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
