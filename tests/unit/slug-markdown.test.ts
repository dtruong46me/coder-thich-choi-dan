import { describe, expect, it } from 'vitest'
import { docToMarkdown, markdownToDoc, splitFrontMatter } from '@/lib/content/markdown'
import { slugify, uniqueSlug } from '@/lib/slug'
import { validateForPublish } from '@/lib/publish'

describe('slugify', () => {
  it('handles Vietnamese', () => {
    expect(slugify('Bách Khoa survival guide: đồ án, deadline và cà phê')).toBe('bach-khoa-survival-guide-do-an-deadline-va-ca-phe')
    expect(slugify('Coder thích chơi đàn')).toBe('coder-thich-choi-dan')
  })
  it('finds a free slug', () => {
    expect(uniqueSlug('fret-math', ['fret-math', 'fret-math-2'])).toBe('fret-math-3')
    expect(uniqueSlug('', [])).toBe('untitled')
  })
})

describe('markdown bridge', () => {
  it('reads front matter', () => {
    const { meta, body } = splitFrontMatter('---\ntitle: "Hello"\ntags: [guitar, math]\n---\n\nBody')
    expect(meta).toEqual({ title: 'Hello', tags: ['guitar', 'math'] })
    expect(body.trim()).toBe('Body')
  })
  it('turns Markdown into blocks', () => {
    const { doc } = markdownToDoc(
      '# Title\n\nSome **bold** and `code` with $x^2$.\n\n> [!TIP] **Nice.** Body\n\n```python title="a.py"\nprint(1)\n```\n\n$$\nE=mc^2\n$$\n\n- [x] done\n- [ ] todo\n\n| a | b |\n|---|---|\n| 1 | 2 |',
    )
    const types = doc.content!.map((n) => n.type)
    expect(types).toEqual(['heading', 'paragraph', 'callout', 'codeBlock', 'blockMath', 'taskList', 'table'])
    expect(doc.content![0]!.attrs).toEqual({ level: 2 })
    expect(doc.content![2]!.attrs).toEqual({ tone: 'tip', title: 'Nice.' })
    expect(doc.content![3]!.attrs).toEqual({ language: 'python', filename: 'a.py' })
    expect(doc.content![5]!.content![0]!.attrs).toEqual({ checked: true })
    const para = doc.content![1]!.content!
    expect(para.find((n) => n.type === 'inlineMath')?.attrs).toEqual({ latex: 'x^2' })
  })
  it('round-trips through Markdown', () => {
    const md = '## Steps\n\n1. one\n2. two\n\n> quote\n\n---\n\n[link](https://example.com)\n'
    const back = docToMarkdown(markdownToDoc(md).doc)
    expect(markdownToDoc(back).doc).toEqual(markdownToDoc(md).doc)
  })
})

describe('validateForPublish', () => {
  const draft = { type: 'doc', content: [{ type: 'image', attrs: { src: '/api/media/x', alt: '' } }] }
  it('needs a title, a clean URL and alt text on every image', () => {
    expect(validateForPublish({ title: '', slug: 'Bad Slug', draftJson: draft })).toEqual([
      'Add a title.',
      'The URL may only use a-z, 0-9 and dashes.',
    ])
    expect(validateForPublish({ title: 'Ok', slug: 'ok', draftJson: draft })).toEqual(['1 image needs alt text.'])
    expect(validateForPublish({ title: 'Ok', slug: 'ok', draftJson: { type: 'doc', content: [] } })).toEqual([])
  })
})
