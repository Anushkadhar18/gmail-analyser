import { Fraunces, Public_Sans } from 'next/font/google'

const display = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})

const body = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

export default function App({ Component, pageProps }) {
  return (
    <div className={`${display.variable} ${body.variable}`} style={{ fontFamily: 'var(--font-body)' }}>
      <Component {...pageProps} />
    </div>
  )
}
