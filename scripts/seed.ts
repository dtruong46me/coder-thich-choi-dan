// Seeds collections, projects and sample posts from the design. Safe to run twice.
// Run: npm run db:seed   (uses DATABASE_URL; needs the react-server condition for server-only modules)
import { eq, sql } from 'drizzle-orm'
import { markdownToDoc } from '../lib/content/markdown'
import { renderDoc } from '../lib/content/render'
import { excerptFrom } from '../lib/content/text'
import { asSystem, db } from '../lib/db/client'
import { collections, postRevisions, posts, postTags, projects, siteSettings, tags } from '../lib/db/schema'
import { unlistedToken } from '../lib/email/tokens'

const COLLECTIONS = [
  { slug: 'guitar', name: 'Guitar Lab', description: 'Fingerstyle, theory, tabs, and the gear I actually use.', defaultVisibility: 'public' as const },
  { slug: 'piano', name: 'Piano Notes', description: 'Learning piano as an adult: practice logs and small tricks.', defaultVisibility: 'public' as const },
  { slug: 'code', name: 'Code & Craft', description: 'Programming, algorithms, and how this site is built.', defaultVisibility: 'public' as const },
  { slug: 'japan', name: 'Life in Japan', description: 'Daily life, the language, part-time jobs, small surprises.', defaultVisibility: 'public' as const },
  { slug: 'bach-khoa', name: 'Bách Khoa Days', description: 'Student life at Bách Khoa: courses, projects, deadlines.', defaultVisibility: 'public' as const },
  { slug: 'diary', name: 'Diary', description: 'Personal entries. Private by default, shared by invite.', defaultVisibility: 'private' as const },
]

const PROJECTS = [
  { slug: 'coderthichchoidan', name: 'coderthichchoidan', kind: 'web', status: 'in_progress' as const, year: '2026', description: 'This website: a blog and a diary in one place, with a notebook-style editor and five levels of privacy.', stack: ['Next.js', 'PostgreSQL', 'Tiptap'], links: [{ label: 'Visit the site', href: '/' }, { label: 'Source', href: 'https://github.com/coderthichchoidan' }], featured: true },
  { slug: 'fret-calculator', name: 'Fret calculator', kind: 'music', status: 'shipped' as const, year: '2026', description: 'Type a scale length, get every fret position to 0.01 mm. Born from measuring my own guitar with a ruler.', stack: ['Python', 'JavaScript'], links: [{ label: 'Code', href: 'https://github.com/coderthichchoidan' }], featured: true },
  { slug: 'kana', name: 'Kana drills', kind: 'cli', status: 'shipped' as const, year: '2026', description: 'Spaced-repetition hiragana and katakana flashcards that live in the terminal.', stack: ['Python'], links: [{ label: 'Code', href: 'https://github.com/coderthichchoidan' }], featured: true },
  { slug: 'chord-loop-player', name: 'Chord loop player', kind: 'music', status: 'in_progress' as const, year: '2026', description: 'The little player on my home page: pick a progression, hear it arpeggiated, watch the globe dance.', stack: ['JavaScript', 'Web Audio'], links: [{ label: 'Live demo', href: '/' }], featured: false },
  { slug: 'tiny-metronome', name: 'Tiny metronome', kind: 'web', status: 'shipped' as const, year: '2026', description: 'Forty lines of JavaScript and a Web Audio scheduler that never drifts.', stack: ['JavaScript', 'Web Audio'], links: [{ label: 'Code', href: 'https://github.com/coderthichchoidan' }], featured: false },
  { slug: 'tab-to-svg', name: 'Tab to SVG', kind: 'music', status: 'in_progress' as const, year: '2026', description: 'Turns plain-text guitar tabs into clean, printable SVG sheets.', stack: ['[STACK]'], links: [], featured: false },
]

const FRET_POST = `I measured my guitar with a ruler one night and noticed the 12th fret sits **exactly** halfway between the nut and the bridge. Coincidence? No. It's the most satisfying piece of maths I know that you can hold in your hands.

> [!NOTE] **TL;DR.** Each fret shortens the string by a factor of $2^{1/12} \\approx 1.05946$. Twelve of those make an octave.

## Twelve equal steps

Equal temperament splits an octave into 12 steps that each multiply the frequency by the same number, so $r^{12} = 2$ and \`r = 2 ** (1/12)\`.

$$
d_n = L\\left(1 - 2^{-n/12}\\right)
$$

## Let Python do it

\`\`\`python title="frets.py"
SCALE_MM = 648  # nut to saddle, in mm

def fret_distance(n: int, L: float = SCALE_MM) -> float:
    """Distance from the nut to fret n."""
    return L * (1 - 2 ** (-n / 12))

for n in range(1, 13):
    print(f"fret {n:>2}: {fret_distance(n):7.2f} mm")
\`\`\`

### Fret table

| Fret | Note (low E) | From nut |
|---:|---|---:|
| 1 | F | 36.37 mm |
| 2 | F♯ | 70.70 mm |
| 5 | A | 162.65 mm |
| 12 | E | 324.00 mm |

- [x] Measure the scale length
- [ ] Add the photo of the ruler
- [ ] Record a short demo video
`

type SeedPost = {
  slug: string
  title: string
  collection: string
  tags: string[]
  date: string
  visibility: 'public' | 'unlisted' | 'members' | 'shared' | 'private'
  kind?: 'blog' | 'diary'
  status?: 'published' | 'draft' | 'scheduled'
  md?: string
  excerpt?: string
}

const lorem = (topic: string) => `A short note about ${topic}. This is sample content from the seed script: replace it with the real post.

## What I tried

Three things, in order, and what each one taught me.

## What stuck

The one habit I kept after a month.`

const POSTS: SeedPost[] = [
  { slug: 'fret-math', title: 'The math of a guitar fret, and why every fret is 2^(1/12)', collection: 'guitar', tags: ['guitar', 'math', 'python'], date: '2026-10-21', visibility: 'public', md: FRET_POST, excerpt: 'Why frets get closer together, the one formula behind it, and a few lines of Python to place every fret.' },
  { slug: 'diary-28-oct', title: 'Diary: 28 Oct', collection: 'diary', tags: [], date: '2026-10-28', visibility: 'private', kind: 'diary' },
  { slug: 'piano-first-30-days', title: 'Learning piano at 20-something: my first 30 days', collection: 'piano', tags: ['piano', 'practice'], date: '2026-10-12', visibility: 'public', excerpt: 'What worked, what hurt my wrists, and the small daily routine I kept.' },
  { slug: 'building-this-blog', title: 'Building this blog: a Notion-style editor with Markdown and LaTeX', collection: 'code', tags: ['webdev', 'latex'], date: '2026-10-03', visibility: 'public', excerpt: 'Blocks, slash commands, math rendering, and how the diary stays private.' },
  { slug: 'konbini-6am-shift', title: 'Konbini, trains and the 6am shift', collection: 'japan', tags: ['japan'], date: '2026-09-26', visibility: 'public', excerpt: 'A week of part-time work in Japan, told through receipts and train delays.' },
  { slug: 'bach-khoa-survival-guide', title: 'Bách Khoa survival guide: đồ án, deadline và cà phê', collection: 'bach-khoa', tags: ['student-life'], date: '2026-09-14', visibility: 'public', excerpt: 'Everything I wish someone had told me in my first year.' },
  { slug: 'fingerstyle-for-programmers', title: 'Fingerstyle for programmers: thinking in loops', collection: 'guitar', tags: ['guitar', 'fingerstyle'], date: '2026-09-02', visibility: 'public', excerpt: 'Travis picking is just a nested for-loop. Here is the pseudocode.' },
  { slug: 'diary-first-month-in-japan', title: 'Diary: first month in Japan', collection: 'diary', tags: [], date: '2026-08-30', visibility: 'shared', kind: 'diary' },
  { slug: 'binary-search-piano', title: 'Binary search, explained with a piano keyboard', collection: 'code', tags: ['algorithms', 'piano', 'python'], date: '2026-08-19', visibility: 'public', excerpt: '88 keys, one target note, at most 7 guesses.' },
  { slug: 'hiragana-in-2-weeks', title: 'Hiragana in 2 weeks with spaced repetition (and a tiny script)', collection: 'japan', tags: ['japan', 'python'], date: '2026-08-05', visibility: 'public', excerpt: 'A 60-line Python flashcard loop that got me reading menus.' },
  { slug: 'tabs-vs-sheet-music', title: 'Reading guitar tabs vs. sheet music', collection: 'guitar', tags: ['guitar', 'theory'], date: '2026-07-22', visibility: 'members', excerpt: 'When each one wins, and how to read both without crying.' },
  { slug: 'capo-math', title: 'Capo math: transposing without tears', collection: 'guitar', tags: ['guitar', 'theory', 'math'], date: '2026-06-30', visibility: 'unlisted', excerpt: 'A lookup table, a formula, and a cheat sheet you can print.' },
  { slug: 'tiny-metronome', title: 'A tiny metronome in 40 lines of JavaScript', collection: 'code', tags: ['webdev', 'practice'], date: '2026-06-18', visibility: 'public', excerpt: 'Web Audio scheduling, explained with a drummer who never drifts.' },
  { slug: 'fingerpicking-cheat-sheet', title: 'Fingerpicking patterns: a printable cheat sheet', collection: 'guitar', tags: ['guitar'], date: '2026-10-29', visibility: 'public', status: 'draft' },
  { slug: 'mua-la-do-o-kyoto', title: 'Mùa lá đỏ ở Kyoto', collection: 'japan', tags: ['japan'], date: '2026-10-25', visibility: 'public', status: 'draft' },
]

async function main() {
  await asSystem(async (tx) => {
    for (const [i, c] of COLLECTIONS.entries()) {
      await tx
        .insert(collections)
        .values({ ...c, position: i })
        .onConflictDoUpdate({ target: collections.slug, set: { name: c.name, description: c.description, position: i, defaultVisibility: c.defaultVisibility } })
    }
    for (const [i, p] of PROJECTS.entries()) {
      await tx.insert(projects).values({ ...p, position: i }).onConflictDoNothing()
    }
    await tx.insert(siteSettings).values({ key: 'emailOnPublishDefault', value: true }).onConflictDoNothing()
  })

  const cols = new Map((await db.select().from(collections)).map((c) => [c.slug, c.id]))

  for (const p of POSTS) {
    const exists = await asSystem((tx) => tx.select({ id: posts.id }).from(posts).where(eq(posts.slug, p.slug)))
    if (exists.length) continue
    const { doc } = markdownToDoc(p.md ?? lorem(p.title.toLowerCase()))
    const rendered = await renderDoc(doc)
    const status = p.status ?? 'published'
    const publishedAt = new Date(`${p.date}T09:00:00+09:00`)
    const excerpt = p.excerpt ?? excerptFrom(rendered.text)
    await asSystem(async (tx) => {
      const [row] = await tx
        .insert(posts)
        .values({
          kind: p.kind ?? 'blog',
          title: p.title,
          slug: p.slug,
          excerpt,
          collectionId: cols.get(p.collection) ?? null,
          status,
          visibility: p.visibility,
          draftJson: doc,
          draftVersion: 1,
          publishedHtml: status === 'published' ? rendered.html : null,
          publishedToc: status === 'published' ? rendered.toc : null,
          publishedAt: status === 'published' ? publishedAt : null,
          unlistedToken: p.visibility === 'unlisted' ? unlistedToken() : null,
          wordCount: rendered.wordCount,
          readingMinutes: rendered.readingMinutes,
          searchVector: sql`post_search_vector(${p.title}, ${excerpt}, ${rendered.text})`,
          createdAt: publishedAt,
          updatedAt: publishedAt,
        })
        .returning({ id: posts.id })
      await tx.insert(postRevisions).values({ postId: row!.id, version: 1, title: p.title, contentJson: doc, reason: status === 'published' ? 'publish' : 'manual' })
      for (const t of p.tags) {
        await tx.insert(tags).values({ slug: t, name: t }).onConflictDoNothing()
        const [tag] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, t))
        await tx.insert(postTags).values({ postId: row!.id, tagId: tag!.id }).onConflictDoNothing()
      }
    })
    console.info(`seeded ${p.slug}`)
  }
  console.info('done')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
