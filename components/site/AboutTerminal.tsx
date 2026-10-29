'use client'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { FsNode } from '@/components/ds/Terminal'

// The terminal's code is split out and loaded after the page shows.
const Terminal = dynamic(() => import('@/components/ds/Terminal').then((m) => m.Terminal), {
  ssr: false,
  loading: () => (
    <div className="ct-term" style={{ height: 380 }}>
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
  en: ['Hi, I am Dinh Truong.', 'A coder who plays guitar and piano.', 'Studied at Bách Khoa, now living in Japan.', 'I write here about code, music practice and everyday life.'],
  vi: ['Xin chào, mình là Đình Trường.', 'Một coder thích chơi đàn: guitar và piano.', 'Từng học Bách Khoa, hiện đang sống ở Nhật.', 'Mình viết về code, luyện đàn và cuộc sống hằng ngày.'],
}

const FS: Record<string, FsNode> = {
  'main.py': {
    content:
      'import DinhTruongPhan as DinhTruong\n\ndef main(lang="en"):\n    me = DinhTruong(alias="coderthichchoidan")\n    me.say_hi(lang)\n    me.print_contacts()\n\nif __name__ == "__main__":\n    main()',
    run: (args) => {
      const l = args.includes('--vi') ? 'vi' : 'en'
      return [
        { type: 'ok', text: `>>> DinhTruong.say_hi(lang="${l}")` },
        ...INTRO[l],
        { type: 'muted', text: l === 'vi' ? 'Liên hệ: cat contact.txt' : 'Contacts: cat contact.txt. Vietnamese: python main.py --vi' },
      ]
    },
  },
  'about.md': { content: '# about\nguitar, piano, python, 日本\nlikes: fingerstyle covers, clean code, konbini onigiri\ndislikes: off-by-one errors, out-of-tune strings' },
  'contact.txt': {
    content:
      'instagram  @coderthichchoidan\ntiktok     @coderthichchoidan\nyoutube    @coderthichchoidan\nlinkedin   in/coderthichchoidan\ngithub     coderthichchoidan\nemail      hello@coderthichchoidan.dev',
  },
  music: { dir: true, children: { 'setlist.txt': { content: 'Canon in D (fingerstyle)\n[YOUR SONG]\n[YOUR SONG]' } } },
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

export function AboutTerminal() {
  const router = useRouter()
  return (
    <Terminal
      fs={FS}
      height={380}
      helpExtra="lang  blogs  projects"
      initialLines={[{ type: 'muted', text: 'Welcome. Type help, or tap a command below.' }]}
      suggestions={['python main.py', 'python main.py --vi', 'ls', 'cat contact.txt', 'cd diary']}
      commands={{
        lang: (args) => (args[0] === 'vi' ? 'Dùng: python main.py --vi' : 'Usage: python main.py, or python main.py --vi for Tiếng Việt'),
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
