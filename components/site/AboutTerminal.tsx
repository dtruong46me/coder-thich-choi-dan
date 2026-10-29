'use client'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { FsNode, HelpSection, TermOutput } from '@/components/ds/Terminal'

const HEIGHT = 460

// The terminal's code is split out and loaded after the page shows.
const Terminal = dynamic(() => import('@/components/ds/Terminal').then((m) => m.Terminal), {
  ssr: false,
  loading: () => (
    <div className="ct-term" style={{ height: HEIGHT }}>
      <div className="ct-term-bar">
        <span className="ct-term-dot ct-dot-close" />
        <span className="ct-term-dot ct-dot-min" />
        <span className="ct-term-dot ct-dot-max" />
        <span className="ct-term-title">dinhtruong@coderthichchoidan: ~</span>
      </div>
      <div className="ct-term-body">
        <div className="ct-term-line ct-term-muted">Booting…</div>
      </div>
    </div>
  ),
})

const INTRO = {
  en: [
    'Hi, I am Dinh Truong.',
    'A coder who plays guitar and piano.',
    'Studied at Bách Khoa, now living in Japan.',
    'I write here about code, music practice and everyday life.',
  ],
  vi: [
    'Xin chào, mình là Đình Trường.',
    'Một coder thích chơi đàn: guitar và piano.',
    'Từng học Bách Khoa, hiện đang sống ở Nhật.',
    'Mình viết về code, luyện đàn và cuộc sống hằng ngày.',
  ],
}

const CONTACTS = [
  'instagram  @coderthichchoidan',
  'tiktok     @coderthichchoidan',
  'youtube    @coderthichchoidan',
  'linkedin   in/coderthichchoidan',
  'github     coderthichchoidan',
  'email      hello@coderthichchoidan.dev',
].join('\n')

// The two files below are real, runnable Python. What `python main.py` prints is exactly what they would print.
const pyList = (lines: string[]) => lines.map((l) => `        ${JSON.stringify(l)},`).join('\n')

const MODULE_PY = `"""Who I am, as a tiny Python module."""
from pathlib import Path

INTRO = {
    "en": [
${pyList(INTRO.en)}
    ],
    "vi": [
${pyList(INTRO.vi)}
    ],
}


class DinhTruongPhan:
    def __init__(self, alias: str) -> None:
        self.alias = alias

    def say_hi(self, lang: str = "en") -> None:
        for line in INTRO.get(lang, INTRO["en"]):
            print(line)

    def print_contacts(self) -> None:
        print()
        print(Path(__file__).with_name("contact.txt").read_text().rstrip())`

const MAIN_PY = `import sys

from dinhtruong import DinhTruongPhan


def main(lang: str = "en") -> None:
    me = DinhTruongPhan(alias="coderthichchoidan")
    me.say_hi(lang)
    me.print_contacts()


if __name__ == "__main__":
    main("vi" if "--vi" in sys.argv[1:] else "en")`

const FS: Record<string, FsNode> = {
  'main.py': {
    content: MAIN_PY,
    run: (argv) => [...INTRO[argv.includes('--vi') ? 'vi' : 'en'], ' ', CONTACTS],
  },
  'dinhtruong.py': { content: MODULE_PY },
  'about.md': {
    content:
      '# about\nguitar, piano, python, 日本\nlikes: fingerstyle covers, clean code, konbini onigiri\ndislikes: off-by-one errors, out-of-tune strings',
  },
  'contact.txt': { content: CONTACTS },
  music: {
    dir: true,
    children: { 'setlist.txt': { content: 'Canon in D (fingerstyle)\n[YOUR SONG]\n[YOUR SONG]' } },
  },
  projects: {
    dir: true,
    children: {
      'fret-calculator.md': { content: 'Fret calculator: every fret to 0.01 mm. Shipped.' },
      'kana-drills.md': { content: 'Kana drills: hiragana in the terminal. Shipped.' },
    },
  },
  diary: { dir: true, locked: true, children: {} },
  'secrets.env': { locked: true, error: "PermissionError: [Errno 13] Permission denied: 'secrets.env'" },
}

const WELCOME: TermOutput = {
  parts: [
    { type: 'muted', text: 'Welcome! Type ' },
    { type: 'info', text: 'help' },
    { type: 'muted', text: ' and press ' },
    { type: 'key', text: 'Enter' },
    { type: 'muted', text: ' to see what you can do.' },
  ],
}

const HELP: HelpSection[] = [
  {
    title: 'start here',
    items: [
      ['python main.py', 'run me: who I am, in a few lines'],
      ['python main.py --vi', 'the same, in Vietnamese'],
    ],
  },
]

export function AboutTerminal() {
  const router = useRouter()
  return (
    <Terminal
      fs={FS}
      height={HEIGHT}
      initialLines={WELCOME}
      autoFocus
      help={HELP}
      commands={{
        lang: (args) =>
          args[0] === 'vi'
            ? 'Dùng: python main.py --vi'
            : 'Usage: python main.py, or python main.py --vi for Tiếng Việt',
        blogs: () => {
          setTimeout(() => router.push('/blogs'), 400)
          return { type: 'ok', text: 'Opening ~/blogs' }
        },
        projects: () => {
          setTimeout(() => router.push('/projects'), 400)
          return { type: 'ok', text: 'Opening ~/projects' }
        },
      }}
    />
  )
}
