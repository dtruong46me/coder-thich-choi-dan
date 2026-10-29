import type { Metadata } from 'next'
import { BlogBrowser } from '@/components/site/BlogBrowser'
import { getCollections, getListing } from '@/lib/db/queries/public'

export const metadata: Metadata = {
  title: 'Blogs & diary',
  description: "Guitar, piano, code, Japan and Bách Khoa. Diary pages stay locked unless I've shared them with you.",
}

export default async function BlogsPage() {
  const [cards, collections] = await Promise.all([getListing(), getCollections()])
  return (
    <>
      <section className="wrap" style={{ paddingTop: 56, paddingBottom: 8 }}>
        <div className="stack-12" style={{ gap: 14, maxWidth: 720 }}>
          <p className="kicker-path">
            <span className="accent">~/blogs</span> $ ls | wc -l → {cards.length}
          </p>
          <h1 className="h1 m0" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>
            Blogs &amp; diary
          </h1>
          <p className="lead m0 muted" style={{ maxWidth: '44ch' }}>
            Guitar, piano, code, Japan and Bách Khoa. Diary pages stay locked unless I&apos;ve shared them with you.
          </p>
        </div>
      </section>
      <BlogBrowser cards={cards} collections={collections} />
    </>
  )
}
