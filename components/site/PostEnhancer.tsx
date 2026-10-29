'use client'
import { useEffect } from 'react'

/** The only script on a post page: copy buttons on code blocks and a one-time view count. */
export function PostEnhancer({ postId }: { postId: string }) {
  useEffect(() => {
    const body = document.getElementById('post-body')
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]')
      if (!btn) return
      const code = btn.closest('figure')?.querySelector('pre')?.textContent ?? ''
      void navigator.clipboard?.writeText(code)
      btn.textContent = 'Copied'
      setTimeout(() => (btn.textContent = 'Copy'), 1500)
    }
    body?.addEventListener('click', onClick)

    const key = `viewed:${postId}`
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        navigator.sendBeacon?.('/api/views', JSON.stringify({ postId }))
      }
    } catch {}
    return () => body?.removeEventListener('click', onClick)
  }, [postId])
  return null
}
