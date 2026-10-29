'use client'
import { del, get, set } from 'idb-keyval'
import { useCallback, useEffect, useRef, useState } from 'react'
import { saveDraft, type SaveResult } from '@/lib/actions/posts'
import type { SaveDraftInput } from '@/lib/validation'

export type Snapshot = {
  title: string
  draftJson: SaveDraftInput['draftJson']
  meta: NonNullable<SaveDraftInput['meta']>
}
export type LocalCopy = Snapshot & { baseVersion: number; at: number }
export type SaveStatus = 'saved' | 'saving' | 'offline' | 'conflict' | 'error'
export type Conflict = { version: number; title: string; draftJson: unknown; updatedAt: string }

const IDLE_MS = 1000 // send after 1 s without typing…
const MAX_WAIT_MS = 10_000 // …or at least every 10 s while typing
const LOCAL_MS = 500 // local copy at most twice a second

const key = (postId: string) => `draft:${postId}`
const fingerprint = (s: Snapshot) => JSON.stringify([s.title, s.draftJson, s.meta])

/**
 * Two layers: every change goes to IndexedDB on this device (no network), and the server gets
 * the draft after a pause in typing. The server only accepts it if `baseVersion` is still current;
 * otherwise we stop and surface a conflict instead of overwriting the other device's work.
 */
export function useAutosave({
  postId,
  initialVersion,
  initialSavedAt,
  getSnapshot,
  onSaved,
}: {
  postId: string
  initialVersion: number
  initialSavedAt: string
  getSnapshot: () => Snapshot
  onSaved?: (res: Extract<SaveResult, { ok: true }>) => void
}) {
  const base = useRef(initialVersion)
  const lastSent = useRef<string | null>(null)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstChangeAt = useRef<number | null>(null)
  const inflight = useRef<Promise<SaveResult> | null>(null)
  const conflictRef = useRef<Conflict | null>(null)
  const snap = useRef(getSnapshot)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    snap.current = getSnapshot
    onSavedRef.current = onSaved
  })

  const [status, setStatus] = useState<SaveStatus>('saved')
  const [savedAt, setSavedAt] = useState(initialSavedAt)
  const [error, setError] = useState('')
  const [conflict, setConflictState] = useState<{ server: Conflict; mine: Snapshot } | null>(null)

  useEffect(() => {
    lastSent.current = fingerprint(snap.current())
  }, [])

  const writeLocal = useCallback(() => {
    if (localTimer.current) return
    localTimer.current = setTimeout(() => {
      localTimer.current = null
      const s = snap.current()
      void set(key(postId), { ...s, baseVersion: base.current, at: Date.now() } satisfies LocalCopy).catch(() => {})
    }, LOCAL_MS)
  }, [postId])

  /** Sends the draft now. Resolves true when the server has the latest content. */
  const flush = useCallback(
    async (first: 'autosave' | 'manual'): Promise<boolean> => {
      let reason = first
      for (;;) {
        if (conflictRef.current) return false
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        firstChangeAt.current = null
        // One request at a time: wait for the one in flight, then send whatever is newer.
        while (inflight.current) await inflight.current
        const s = snap.current()
        const fp = fingerprint(s)
        if (fp === lastSent.current && (reason === 'autosave' || !dirty.current)) {
          dirty.current = false
          setStatus('saved')
          return true
        }
        setStatus('saving')
        const req = saveDraft({ postId, baseVersion: base.current, title: s.title, draftJson: s.draftJson, meta: s.meta, reason }).catch(
          (): SaveResult => ({ ok: false, error: 'Could not reach the server.' }),
        )
        inflight.current = req
        const res = await req
        inflight.current = null

        if (res.ok) {
          base.current = res.version
          lastSent.current = fp
          setSavedAt(res.savedAt)
          setError('')
          onSavedRef.current?.(res)
          if (fingerprint(snap.current()) !== fp) {
            reason = 'autosave' // more edits arrived while saving: send those too
            continue
          }
          dirty.current = false
          void del(key(postId)).catch(() => {})
          setStatus('saved')
          return true
        }
        if (res.conflict) {
          conflictRef.current = res.conflict
          setConflictState({ server: res.conflict, mine: s })
          setStatus('conflict')
          return false
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) setStatus('offline')
        else {
          setStatus('error')
          setError(res.error)
        }
        return false
      }
    },
    [postId],
  )

  /** Call on every edit. */
  const change = useCallback(() => {
    dirty.current = true
    writeLocal()
    if (conflictRef.current) return
    setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'saving')
    const now = Date.now()
    firstChangeAt.current ??= now
    const wait = Math.max(0, Math.min(IDLE_MS, firstChangeAt.current + MAX_WAIT_MS - now))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush('autosave'), wait)
  }, [flush, writeLocal])

  const resolve = useCallback(
    (choice: 'mine' | 'theirs', applyTheirs: (c: Conflict) => void) => {
      const c = conflictRef.current
      if (!c) return
      conflictRef.current = null
      setConflictState(null)
      base.current = c.version
      if (choice === 'theirs') {
        applyTheirs(c)
        lastSent.current = fingerprint(snap.current())
        dirty.current = false
        void del(key(postId)).catch(() => {})
        setStatus('saved')
      } else {
        void flush('manual')
      }
    },
    [flush, postId],
  )

  // Back online: push what is waiting. Leaving with unsent changes: ask the browser to warn.
  useEffect(() => {
    const online = () => dirty.current && void flush('autosave')
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('online', online)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('beforeunload', beforeUnload)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [flush])

  /** After loading a version from the server (e.g. History restore): treat it as saved. */
  const adopt = useCallback(
    (version: number, at: string) => {
      base.current = version
      lastSent.current = fingerprint(snap.current())
      dirty.current = false
      void del(key(postId)).catch(() => {})
      setSavedAt(at)
      setStatus('saved')
    },
    [postId],
  )

  return { status, savedAt, error, conflict, change, saveNow: () => flush('manual'), resolve, adopt }
}

/** A newer copy left on this device (e.g. the tab was closed while offline), if there is one. */
export async function findLocalCopy(postId: string, serverUpdatedAt: string, server: Snapshot): Promise<LocalCopy | null> {
  try {
    const local = await get<LocalCopy>(key(postId))
    if (!local || local.at <= Date.parse(serverUpdatedAt)) return null
    return fingerprint(local) === fingerprint(server) ? null : local
  } catch {
    return null
  }
}

export const discardLocalCopy = (postId: string) => del(key(postId)).catch(() => {})
