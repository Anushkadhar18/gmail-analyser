import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '../lib/api'
import Layout from '../components/Layout'
import { PALETTE, cardStyle } from '../lib/theme'

const FEATURES = [
  { href: '/chat', title: 'Chat', desc: 'Draft replies and propose meetings by just asking.' },
  { href: '/drafts', title: 'Drafts', desc: 'Review, approve, and send AI-drafted replies.' },
  { href: '/tasks', title: 'Tasks', desc: 'Action items automatically extracted from your inbox.' },
  { href: '/extract', title: 'Extract Tasks', desc: 'Pull tasks out of a specific thread or message.' },
  { href: '/approvals', title: 'Approvals', desc: 'Anything pending your sign-off before it goes out.' },
  { href: '/meetings', title: 'Meeting Briefs', desc: 'Generate a brief from a calendar event.' },
]

export default function Home() {
  const [user, setUser] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    apiFetch('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecked(true))
  }, [])

  return (
    <Layout
      title="Gmail & Calendar Assistant"
      subtitle={
        checked && user
          ? `Connected as ${user.email}. Everything below drafts and proposes — nothing sends without your review.`
          : 'Connect your Google account to draft replies, extract tasks, and propose meetings — with your approval required before anything sends.'
      }
    >
      {checked && !user && (
        <p style={{ color: PALETTE.muted, fontSize: 14 }}>Use "Connect Google" in the top right to get started.</p>
      )}

      {checked && user && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="feature-card" style={{ ...cardStyle, height: '100%', cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, marginBottom: 4 }}>{f.title}</div>
                <div style={{ color: PALETTE.muted, fontSize: 13.5, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style jsx global>{`
        .feature-card {
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .feature-card:hover {
          border-color: ${PALETTE.accent} !important;
          transform: translateY(-1px);
        }
      `}</style>
    </Layout>
  )
}
