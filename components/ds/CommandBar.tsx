'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from './cx'

export type Command = {
  cmd: string
  aliases?: string[]
  desc: string
  href?: string
  /** Return true to keep the bar open (e.g. after showing results). */
  run?: (args: string[]) => boolean | void | Promise<boolean | void>
}

export type Hit = { label: string; meta?: string; href: string }

/**
 * The vim-style ":" command line. Loaded lazily the first time someone presses ":".
 * `onSearch` powers ":search <words>" with results shown right in the bar.
 */
export default function CommandBar({
  open,
  onClose,
  commands,
  placeholder = 'blogs, projects, about, help',
  onSearch,
}: {
  open: boolean
  onClose: () => void
  commands: Command[]
  placeholder?: string
  onSearch?: (q: string) => Promise<Hit[]>
}) {
  const router = useRouter()
  const id = useId()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [err, setErr] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  const text = q.replace(/^:+/, '').trim()
  const word = text.split(/\s+/)[0] ?? ''
  const items = hits
    ? []
    : commands.filter(
        (c) => !word || [c.cmd, ...(c.aliases ?? [])].some((n) => n.startsWith(word)) || c.desc.toLowerCase().includes(word.toLowerCase()),
      )
  const listLen = hits ? hits.length : items.length
  const active = Math.min(sel, Math.max(0, listLen - 1))

  const find = (name: string) => commands.find((c) => c.cmd === name || c.aliases?.includes(name))

  async function exec(c: Command | undefined, args: string[]) {
    if (!c) return
    if (c.href) {
      if (c.href.startsWith('#')) {
        onClose()
        document.querySelector(c.href)?.scrollIntoView({ behavior: 'smooth' })
        return
      }
      router.push(c.href)
      return onClose()
    }
    if (c.run) {
      const keep = await c.run(args)
      if (keep !== true) onClose()
      return
    }
    onClose()
  }

  async function submit() {
    if (hits) {
      const h = hits[active]
      if (h) {
        router.push(h.href)
        onClose()
      }
      return
    }
    const [name = '', ...args] = text.split(/\s+/)
    if (!name) return exec(items[active], [])
    if (['q', 'quit', 'close'].includes(name)) return onClose()
    if ((name === 'search' || name === 's') && onSearch) {
      const query = args.join(' ')
      if (query.length < 2) return setErr('Type at least two letters: :search fret')
      const res = await onSearch(query).catch(() => [])
      setHits(res)
      setSel(0)
      if (!res.length) setErr(`No posts match "${query}".`)
      return
    }
    let c = find(name)
    if (!c && items.length === 1) c = items[0]
    if (!c) return setErr(`E492: Not an editor command: ${name}`)
    return exec(c, args)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((active + 1) % Math.max(1, listLen))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((active - 1 + listLen) % Math.max(1, listLen))
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (items[active]) setQ(`${items[active].cmd} `)
    } else if (e.key === 'Backspace' && q === '') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <>
      <div className="ct-cmd-scrim" onMouseDown={onClose} aria-hidden="true" />
      <div className="ct-cmd" role="dialog" aria-label="Command line">
        {hits && hits.length ? (
          <ul className="ct-cmd-list" role="listbox" id={`${id}-list`}>
            {hits.map((h, i) => (
              <li
                key={h.href}
                role="option"
                aria-selected={i === active}
                className={cx('ct-cmd-item', i === active && 'is-on')}
                onMouseEnter={() => setSel(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  router.push(h.href)
                  onClose()
                }}
              >
                <span className="ct-cmd-name">{h.label}</span>
                <span className="ct-cmd-alias" />
                <span className="ct-cmd-desc">{h.meta}</span>
              </li>
            ))}
          </ul>
        ) : items.length ? (
          <ul className="ct-cmd-list" role="listbox" id={`${id}-list`}>
            {items.map((c, i) => (
              <li
                key={c.cmd}
                role="option"
                aria-selected={i === active}
                className={cx('ct-cmd-item', i === active && 'is-on')}
                onMouseEnter={() => setSel(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  void exec(c, [])
                }}
              >
                <span className="ct-cmd-name">:{c.cmd}</span>
                <span className="ct-cmd-alias">{(c.aliases ?? []).map((a) => `:${a}`).join(' ')}</span>
                <span className="ct-cmd-desc">{c.desc}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {err ? (
          <div className="ct-cmd-err" role="alert">
            {err}
          </div>
        ) : null}
        <div className="ct-cmd-line">
          <span className="ct-cmd-colon" aria-hidden="true">
            :
          </span>
          <label className="ct-sr" htmlFor={id}>
            Command
          </label>
          <input
            id={id}
            ref={inputRef}
            className="ct-cmd-input"
            value={q}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-controls={`${id}-list`}
            placeholder={placeholder}
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
              setErr('')
              setHits(null)
            }}
            onKeyDown={onKey}
          />
          <span className="ct-cmd-hint">Enter to go · Tab to complete · Esc to close</span>
        </div>
      </div>
    </>
  )
}
