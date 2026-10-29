'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type TermLine = { type: 'out' | 'ok' | 'err' | 'muted' | 'accent' | 'cmd'; text: string; path?: string }
export type TermOutput = string | { type?: TermLine['type']; text: string } | TermOutput[] | undefined | null

export type FsNode = {
  dir?: boolean
  locked?: boolean
  error?: string
  content?: string
  run?: (args: string[]) => TermOutput
  children?: Record<string, FsNode>
}

function norm(x: TermOutput, type: TermLine['type'] = 'out'): TermLine[] {
  if (x === undefined || x === null) return []
  if (typeof x === 'string') return [{ type, text: x }]
  if (Array.isArray(x)) return x.flatMap((l) => norm(l, type))
  return [{ type: x.type ?? type, text: x.text }]
}

/** A tiny fake shell for the About page: ls, cd, cat, python main.py, history, and a locked diary. */
export function Terminal({
  fs,
  commands = {},
  initialLines = [],
  suggestions = [],
  height,
  helpExtra,
  user = 'dinhtruong',
  host = 'coderthichchoidan',
}: {
  fs: Record<string, FsNode>
  commands?: Record<string, (args: string[]) => TermOutput>
  initialLines?: TermOutput
  suggestions?: string[]
  height?: number
  helpExtra?: string
  user?: string
  host?: string
}) {
  const root: FsNode = { dir: true, children: fs }
  const [lines, setLines] = useState<TermLine[]>(() => norm(initialLines))
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState<string[]>([])
  const [hist, setHist] = useState<string[]>([])
  const hIdx = useRef(-1)
  const body = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight
  }, [lines])

  const pathStr = (segs: string[]) => `~${segs.length ? `/${segs.join('/')}` : ''}`
  function resolve(p: string) {
    const segs = p.startsWith('/') || p === '~' || p.startsWith('~/') ? [] : [...cwd]
    p.replace(/^~\/?/, '')
      .split('/')
      .forEach((s) => {
        if (!s || s === '.') return
        if (s === '..') segs.pop()
        else segs.push(s)
      })
    let node: FsNode | undefined = root
    for (let i = 0; i < segs.length; i++) {
      const next: FsNode | undefined = node?.dir ? node.children?.[segs[i]!] : undefined
      if (!next) return { segs, node: null as FsNode | null, blocked: false }
      node = next
      if (node.locked && i < segs.length - 1) return { segs, node, blocked: true }
    }
    return { segs, node: node ?? null, blocked: false }
  }
  const denied = (cmd: string, name: string, node: FsNode | null): TermOutput => ({
    type: 'err',
    text: node?.error ?? `${cmd}: ${name}: Permission denied`,
  })

  const builtins: Record<string, (args: string[]) => TermOutput> = {
    help: () => [
      { type: 'accent', text: 'available commands' },
      '  python main.py   run me (the About page, as code)',
      '  ls [dir]         list files        cd <dir>     change directory',
      '  cat <file>       print a file      pwd          where am I',
      `  whoami  echo  history  clear  help${helpExtra ? `  ${helpExtra}` : ''}`,
    ],
    ls: (args) => {
      const r = resolve(args[0] ?? '')
      if (r.blocked || r.node?.locked) return denied('ls: cannot open directory', args[0] ?? '.', r.node)
      if (!r.node) return { type: 'err', text: `ls: cannot access '${args[0]}': No such file or directory` }
      if (!r.node.dir) return args[0]
      return (
        Object.entries(r.node.children ?? {})
          .map(([k, n]) => k + (n.dir ? '/' : ''))
          .join('   ') || '(empty)'
      )
    },
    cd: (args) => {
      if (!args[0] || args[0] === '~') {
        setCwd([])
        return []
      }
      const r = resolve(args[0])
      if (!r.node) return { type: 'err', text: `cd: no such file or directory: ${args[0]}` }
      if (r.blocked || r.node.locked) return denied('cd', args[0], r.node)
      if (!r.node.dir) return { type: 'err', text: `cd: not a directory: ${args[0]}` }
      setCwd(r.segs)
      return []
    },
    pwd: () => `/home/${user}${cwd.length ? `/${cwd.join('/')}` : ''}`,
    cat: (args) => {
      if (!args[0]) return { type: 'err', text: 'cat: missing file operand' }
      const r = resolve(args[0])
      if (!r.node) return { type: 'err', text: `cat: ${args[0]}: No such file or directory` }
      if (r.blocked || r.node.locked) return denied('cat', args[0], r.node)
      if (r.node.dir) return { type: 'err', text: `cat: ${args[0]}: Is a directory` }
      return r.node.content
    },
    python: (args) => {
      if (!args[0]) return { type: 'muted', text: 'Python 3.12 (fake). The REPL is shy. Try: python main.py' }
      const r = resolve(args[0])
      if (!r.node) return { type: 'err', text: `python: can't open file '${args[0]}': [Errno 2] No such file or directory` }
      if (r.blocked || r.node.locked) return { type: 'err', text: r.node.error ?? `PermissionError: [Errno 13] Permission denied: '${args[0]}'` }
      if (!r.node.run) return { type: 'err', text: `  File "${args[0]}", line 1\nSyntaxError: this is not Python` }
      return r.node.run(args.slice(1))
    },
    whoami: () => user,
    echo: (args) => args.join(' '),
    history: () => hist.map((c, i) => `  ${i + 1}  ${c}`).join('\n') || '(empty)',
    sudo: () => [
      { type: 'muted', text: `[sudo] password for ${user}:` },
      { type: 'err', text: 'Nice try. This incident will be reported.' },
    ],
    exit: () => ({ type: 'muted', text: 'There is no exit. Only cd ..' }),
  }
  builtins.python3 = builtins.python!

  function run(raw: string) {
    const cmdLine: TermLine = { type: 'cmd', text: raw, path: pathStr(cwd) }
    const trimmed = raw.trim()
    if (!trimmed) return setLines((l) => [...l, cmdLine])
    setHist((h) => [...h, trimmed])
    hIdx.current = -1
    if (trimmed === 'clear') return setLines([])
    const [name = '', ...args] = trimmed.split(/\s+/)
    let res: TermOutput
    try {
      const fn = commands[name] ?? builtins[name]
      res = fn ? fn(args) : { type: 'err', text: `command not found: ${name}. Type 'help'.` }
    } catch (e) {
      res = { type: 'err', text: `Traceback (most recent call last):\n  ${String(e)}` }
    }
    setLines((l) => [...l, cmdLine, ...norm(res)])
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      run(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!hist.length) return
      hIdx.current = hIdx.current < 0 ? hist.length - 1 : Math.max(0, hIdx.current - 1)
      setInput(hist[hIdx.current] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (hIdx.current < 0) return
      hIdx.current += 1
      if (hIdx.current >= hist.length) {
        hIdx.current = -1
        setInput('')
      } else setInput(hist[hIdx.current] ?? '')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const bits = input.split(' ')
      const last = bits[bits.length - 1] ?? ''
      const here = resolve('').node
      const hit = Object.keys(here?.children ?? {}).filter((n) => n.startsWith(last))
      if (hit.length === 1) {
        bits[bits.length - 1] = hit[0]! + (here?.children?.[hit[0]!]?.dir ? '/' : '')
        setInput(bits.join(' '))
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  const prompt = (path: string): ReactNode => (
    <>
      <span className="ct-term-user">
        {user}@{host}
      </span>
      :<span className="ct-term-path">{path}</span>
      <span className="ct-term-dollar">$ </span>
    </>
  )

  return (
    <div className="ct-term" style={height ? { height } : undefined}>
      <div className="ct-term-bar">
        <span className="ct-term-dot ct-dot-close" />
        <span className="ct-term-dot ct-dot-min" />
        <span className="ct-term-dot ct-dot-max" />
        <span className="ct-term-title">
          {user}@{host}: {pathStr(cwd)}
        </span>
      </div>
      <div
        className="ct-term-body"
        ref={body}
        role="log"
        aria-live="polite"
        onClick={() => {
          if (inputRef.current && !String(window.getSelection())) inputRef.current.focus()
        }}
      >
        {lines.map((l, i) =>
          l.type === 'cmd' ? (
            <div key={i} className="ct-term-line">
              {prompt(l.path ?? '~')}
              {l.text}
            </div>
          ) : (
            <div key={i} className={`ct-term-line ct-term-${l.type}`}>
              {l.text}
            </div>
          ),
        )}
        <div className="ct-term-line ct-term-input-row">
          {prompt(pathStr(cwd))}
          <label className="ct-sr" htmlFor="ct-term-in">
            Terminal command
          </label>
          <input
            id="ct-term-in"
            ref={inputRef}
            className="ct-term-input"
            value={input}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
          />
        </div>
      </div>
      {suggestions.length ? (
        <div className="ct-term-sugg">
          {suggestions.map((s) => (
            <button key={s} type="button" className="ct-term-chip" onClick={() => run(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
