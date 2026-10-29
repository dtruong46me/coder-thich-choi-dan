'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type TermColor = 'out' | 'ok' | 'err' | 'muted' | 'accent' | 'info' | 'key' | 'dir'
export type TermSpan = { type?: TermColor; text: string }
export type TermLine = { type: TermColor | 'cmd'; text: string; path?: string; parts?: TermSpan[] }
export type TermOutput = string | TermSpan | { parts: TermSpan[] } | TermOutput[] | undefined | null
/** One block of `help`: commands on the left (args in <> [] or --flags get their own color), what they do on the right. */
export type HelpSection = { title: string; items: [cmd: string, desc: string][] }

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
  if ('parts' in x) return [{ type, text: x.parts.map((p) => p.text).join(''), parts: x.parts }]
  return [{ type: x.type ?? type, text: x.text }]
}

const BUILTIN_HELP: HelpSection[] = [
  {
    title: 'basic commands',
    items: [
      ['ls [dir]', 'list files'],
      ['cd <dir>', 'change directory (cd .. goes up)'],
      ['cat <file>', 'print a file'],
      ['python <file>', 'run a Python file'],
      ['pwd', 'print the current directory'],
      ['whoami', 'who is logged in'],
      ['echo <text>', 'print the text back'],
      ['history', 'commands you typed'],
      ['clear', 'clear the screen'],
      ['help', 'show this again'],
    ],
  },
]

function helpLines(sections: HelpSection[]): TermOutput {
  const width = Math.max(...sections.flatMap((s) => s.items.map(([c]) => c.length))) + 3
  const cmdSpans = (cmd: string): TermSpan[] =>
    cmd.split(' ').map((w, i) => ({ type: /^[<[-]/.test(w) ? 'key' : 'info', text: (i ? ' ' : '') + w }))
  return [
    {
      parts: [
        { type: 'accent', text: 'coderthichchoidan shell' },
        { type: 'muted', text: ', a tiny fake terminal. Things you can type:' },
      ],
    },
    ...sections.flatMap((s) => [
      ' ',
      { type: 'ok' as const, text: s.title.toUpperCase() },
      ...s.items.map(([cmd, desc]) => ({
        parts: [
          { text: '  ' },
          ...cmdSpans(cmd),
          { text: ' '.repeat(width - cmd.length) },
          { type: 'muted' as const, text: desc },
        ],
      })),
    ]),
    ' ',
    {
      parts: [
        { type: 'muted', text: 'tips: ' },
        { type: 'key', text: '↑ ↓' },
        { type: 'muted', text: ' history · ' },
        { type: 'key', text: 'Tab' },
        { type: 'muted', text: ' completes names · ' },
        { type: 'key', text: 'Ctrl+L' },
        { type: 'muted', text: ' clears' },
      ],
    },
  ]
}

/** A tiny fake shell for the About page: ls, cd, cat, python main.py, history, and a locked diary. */
export function Terminal({
  fs,
  commands = {},
  initialLines = [],
  autoFocus = false,
  height,
  help = [],
  user = 'dinhtruong',
  host = 'coderthichchoidan',
}: {
  fs: Record<string, FsNode>
  commands?: Record<string, (args: string[]) => TermOutput>
  initialLines?: TermOutput
  /** Focus the prompt on load. Only on devices with a mouse, so phones don't pop up the keyboard. */
  autoFocus?: boolean
  height?: number
  /** Sections shown in `help` before the built-in ones. */
  help?: HelpSection[]
  user?: string
  host?: string
}) {
  const root: FsNode = { dir: true, children: fs }
  const [lines, setLines] = useState<TermLine[]>(() => norm(initialLines))
  const [input, setInput] = useState('')
  // Where the block cursor sits. The real caret is hidden; the cursor is drawn over a mirror of the input.
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const [cwd, setCwd] = useState<string[]>([])
  const [hist, setHist] = useState<string[]>([])
  const hIdx = useRef(-1)
  const body = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight
  }, [lines])

  useEffect(() => {
    if (autoFocus && matchMedia('(pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

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
    help: () => helpLines([...help, ...BUILTIN_HELP]),
    ls: (args) => {
      const r = resolve(args[0] ?? '')
      if (r.blocked || r.node?.locked) return denied('ls: cannot open directory', args[0] ?? '.', r.node)
      if (!r.node) return { type: 'err', text: `ls: cannot access '${args[0]}': No such file or directory` }
      if (!r.node.dir) return args[0]
      const entries = Object.entries(r.node.children ?? {})
      if (!entries.length) return { type: 'muted', text: '(empty)' }
      return {
        parts: entries.map(([k, n], i) => ({
          type: n.locked ? 'err' : n.dir ? 'dir' : n.run ? 'ok' : 'out',
          text: (i ? '   ' : '') + k + (n.dir ? '/' : ''),
        })),
      }
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
      // A .py file with no `run` is a plain module: running it defines things and prints nothing.
      if (!r.node.run) {
        if (args[0].endsWith('.py')) return []
        return { type: 'err', text: `  File "${args[0]}", line 1\nSyntaxError: this is not Python` }
      }
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

  // Replaces the whole input (history, Tab) and puts the cursor at the end, like a shell does.
  function setLine(v: string) {
    setInput(v)
    setCaret(v.length)
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(v.length, v.length))
  }
  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? input.length)

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      run(input)
      setLine('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!hist.length) return
      hIdx.current = hIdx.current < 0 ? hist.length - 1 : Math.max(0, hIdx.current - 1)
      setLine(hist[hIdx.current] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (hIdx.current < 0) return
      hIdx.current += 1
      if (hIdx.current >= hist.length) {
        hIdx.current = -1
        setLine('')
      } else setLine(hist[hIdx.current] ?? '')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const bits = input.split(' ')
      const last = bits[bits.length - 1] ?? ''
      const here = resolve('').node
      const hit = Object.keys(here?.children ?? {}).filter((n) => n.startsWith(last))
      if (hit.length === 1) {
        bits[bits.length - 1] = hit[0]! + (here?.children?.[hit[0]!]?.dir ? '/' : '')
        setLine(bits.join(' '))
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
              {l.parts
                ? l.parts.map((p, j) => (
                    <span key={j} className={p.type ? `ct-term-${p.type}` : undefined}>
                      {p.text}
                    </span>
                  ))
                : l.text}
            </div>
          ),
        )}
        <div className="ct-term-line ct-term-input-row">
          {prompt(pathStr(cwd))}
          <span className="ct-term-field">
            <span className="ct-term-mirror" aria-hidden="true">
              {input.slice(0, caret)}
              {/* Keyed on the text so the blink restarts: the cursor stays solid while you type. */}
              <span key={`${caret}:${input}`} className={`ct-term-cursor${focused ? ' is-focused' : ''}`}>
                {input[caret] ?? ' '}
              </span>
              {input.slice(caret + 1)}
            </span>
            {/* aria-label, not a hidden <label>: hidden text would end up in what visitors copy. */}
            <input
              ref={inputRef}
              aria-label="Terminal command"
              className="ct-term-input"
              value={input}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              onChange={(e) => {
                setInput(e.target.value)
                setCaret(e.target.selectionStart ?? e.target.value.length)
              }}
              onSelect={syncCaret}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKey}
            />
          </span>
        </div>
      </div>
    </div>
  )
}
