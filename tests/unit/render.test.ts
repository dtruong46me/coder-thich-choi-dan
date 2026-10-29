import { describe, expect, it } from 'vitest'
import { renderDoc, safeHref } from '@/lib/content/render'
import type { Doc, DocNode } from '@/lib/content/types'

const doc = (...content: DocNode[]): Doc => ({ type: 'doc', content })
const p = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content })
const t = (text: string, marks?: DocNode['marks']): DocNode => ({ type: 'text', text, ...(marks ? { marks } : {}) })

describe('renderDoc: whitelist', () => {
  it('escapes text, so stored content can never inject HTML', async () => {
    const { html } = await renderDoc(doc(p(t('<script>alert(1)</script> & "x"'))))
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>')
  })
  it('drops unknown nodes but keeps their known children', async () => {
    const { html } = await renderDoc(doc({ type: 'iframe', attrs: { src: 'https://evil.test' }, content: [p(t('kept'))] }))
    expect(html).toBe('<p>kept</p>')
  })
  it('only allows http, https, mailto and relative links', async () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,hi')).toBeNull()
    expect(safeHref('//evil.test')).toBeNull()
    expect(safeHref('https://ok.test')).toBe('https://ok.test')
    expect(safeHref('/blogs')).toBe('/blogs')
    const { html } = await renderDoc(doc(p(t('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]))))
    expect(html).toBe('<p>x</p>')
  })
  it('external links get rel=noopener nofollow', async () => {
    const { html } = await renderDoc(doc(p(t('x', [{ type: 'link', attrs: { href: 'https://ok.test' } }]))))
    expect(html).toContain('rel="noopener noreferrer nofollow"')
  })
  it('images must come from our own media route', async () => {
    const id = '0190f5a2-1111-7000-8000-000000000000'
    const ok = await renderDoc(doc({ type: 'image', attrs: { src: `/api/media/${id}`, mediaId: id, alt: 'Ruler on a fretboard' } }))
    expect(ok.html).toContain(`src="/api/media/${id}"`)
    expect(ok.html).toContain('alt="Ruler on a fretboard"')
    const bad = await renderDoc(doc({ type: 'image', attrs: { src: 'https://tracker.test/pixel.gif', alt: 'x' } }))
    expect(bad.html).toBe('')
  })
  it('YouTube embeds use youtube-nocookie and a validated id', async () => {
    const ok = await renderDoc(doc({ type: 'youtube', attrs: { videoId: 'dQw4w9WgXcQ' } }))
    expect(ok.html).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    const bad = await renderDoc(doc({ type: 'youtube', attrs: { videoId: '"><script>' } }))
    expect(bad.html).toBe('')
  })
})

describe('renderDoc: headings and table of contents', () => {
  it('h1 becomes h2 (the title is the only h1) and ids are unique slugs', async () => {
    const h = (level: number, text: string): DocNode => ({ type: 'heading', attrs: { level }, content: [t(text)] })
    const { html, toc } = await renderDoc(doc(h(1, 'Đàn guitar'), h(3, 'Setup'), h(2, 'Đàn guitar'), h(4, 'Deep')))
    expect(html).toContain('<h2 id="dan-guitar">')
    expect(html).toContain('<h2 id="dan-guitar-2">')
    expect(toc).toEqual([
      { id: 'dan-guitar', text: 'Đàn guitar', level: 2 },
      { id: 'setup', text: 'Setup', level: 3 },
      { id: 'dan-guitar-2', text: 'Đàn guitar', level: 2 },
    ])
  })
})

describe('renderDoc: code, math and stats', () => {
  it('highlights code on the server with CSS variables', async () => {
    const { html } = await renderDoc(
      doc({ type: 'codeBlock', attrs: { language: 'python', filename: 'frets.py' }, content: [t('def f(n):\n    return 2 ** n')] }),
    )
    expect(html).toContain('frets.py · python')
    expect(html).toContain('var(--shiki-')
    expect(html).not.toContain('<script')
  })
  it('renders math with KaTeX and never trusts \\href', async () => {
    const { html } = await renderDoc(doc({ type: 'blockMath', attrs: { latex: 'd_n = L(1 - 2^{-n/12})' } }, p({ type: 'inlineMath', attrs: { latex: '\\href{javascript:alert(1)}{x}' } })))
    expect(html).toContain('class="katex-display"')
    // \href is refused (shown as an error in red); the source only survives as escaped annotation text.
    expect(html).not.toMatch(/<a\b|href=/)
  })
  it('counts words and reading time', async () => {
    const words = Array.from({ length: 440 }, (_, i) => `w${i}`).join(' ')
    const r = await renderDoc(doc(p(t(words))))
    expect(r.wordCount).toBe(440)
    expect(r.readingMinutes).toBe(2)
  })
})
