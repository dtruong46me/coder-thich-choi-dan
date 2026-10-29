import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro, JetBrains_Mono, Newsreader } from 'next/font/google'
import type { ReactNode } from 'react'
import { SITE } from '@/lib/site'
import './globals.css'
import { THEME_SCRIPT } from './theme-script'

// Self-hosted by next/font: latin + vietnamese subsets only, swap, and only the display face is preloaded.
const display = Newsreader({
  subsets: ['latin', 'vietnamese'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
})
const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  display: 'swap',
  preload: false,
  variable: '--font-be-vietnam',
})
const mono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s | ${SITE.name}` },
  description: SITE.description,
  alternates: { types: { 'application/rss+xml': '/rss.xml' } },
  openGraph: { siteName: SITE.name, type: 'website' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1b18' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
