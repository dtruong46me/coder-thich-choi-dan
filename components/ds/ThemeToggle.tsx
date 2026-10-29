'use client'
import { useSyncExternalStore } from 'react'
import { IconButton } from './primitives'

export type Theme = 'light' | 'dark'

// The <html data-theme> attribute is the single source of truth. app/theme-script sets it before paint.
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}
const read = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem('theme', next)
  } catch {}
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => 'light')
}

export function ThemeToggle() {
  const theme = useTheme()
  return (
    <IconButton
      icon={theme === 'dark' ? 'sun' : 'moon'}
      label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    />
  )
}
