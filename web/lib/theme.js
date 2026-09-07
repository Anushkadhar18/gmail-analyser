export const PALETTE = {
  bg: '#FAF9F5',
  panel: '#FFFFFF',
  border: '#E4DFD3',
  borderStrong: '#1F2422',
  text: '#1F2422',
  muted: '#8A8478',
  accent: '#1B4B43',
  accentDark: '#123832',
  userBubble: '#E8F1EE',
  userText: '#153A34',
  assistantBubble: '#F3F1EA',
  danger: '#B5502D',
  dangerBg: '#FBEDE7',
  success: '#3F7A5C',
  successBg: '#EAF3EC',
  warning: '#B08B2A',
  warningBg: '#FBF4E1',
}

export const cardStyle = {
  background: PALETTE.panel,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 1px 2px rgba(31,36,34,0.03), 0 4px 16px rgba(31,36,34,0.04)',
}

export const primaryButtonStyle = {
  background: PALETTE.accent,
  color: 'white',
  border: 'none',
  borderRadius: 9,
  padding: '9px 16px',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
}

export const secondaryButtonStyle = {
  background: PALETTE.panel,
  color: PALETTE.text,
  border: `1.5px solid ${PALETTE.border}`,
  borderRadius: 9,
  padding: '8px 15px',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
}

export const dangerButtonStyle = {
  ...secondaryButtonStyle,
  color: PALETTE.danger,
  borderColor: '#EAD3C8',
}

export const inputStyle = {
  padding: '9px 12px',
  fontSize: 14,
  fontFamily: 'var(--font-body)',
  color: PALETTE.text,
  border: `1.5px solid ${PALETTE.border}`,
  borderRadius: 9,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export function statusPillStyle(kind) {
  const map = {
    pending: { bg: PALETTE.warningBg, color: PALETTE.warning },
    approved: { bg: PALETTE.successBg, color: PALETTE.success },
    queued: { bg: PALETTE.userBubble, color: PALETTE.userText },
    sent: { bg: PALETTE.userBubble, color: PALETTE.userText },
    error: { bg: PALETTE.dangerBg, color: PALETTE.danger },
    default: { bg: PALETTE.assistantBubble, color: PALETTE.muted },
  }
  const c = map[kind] || map.default
  return {
    display: 'inline-block',
    background: c.bg,
    color: c.color,
    fontSize: 11.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '3px 9px',
    borderRadius: 999,
  }
}
