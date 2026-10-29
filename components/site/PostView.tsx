import 'katex/dist/katex.min.css'
import Link from 'next/link'
import { VisibilityBadge } from '@/components/ds/primitives'
import type { PublicPost } from '@/lib/db/queries/public'
import { formatDate } from '@/lib/format'
import { BackLink } from './BackLink'
import { PostEnhancer } from './PostEnhancer'

/** A published post. `post.html` was rendered at publish time by the whitelist renderer, never from raw user HTML. */
export function PostView({ post }: { post: PublicPost }) {
  return (
    <article className="wrap" style={{ paddingTop: 48, paddingBottom: 72 }}>
      <header className="stack-12" style={{ maxWidth: 'var(--prose-max)', marginBottom: 36 }}>
        <BackLink />
        <p className="small m0">
          {post.collection ? (
            <Link href={`/blogs?collection=${post.collection.slug}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
              {post.collection.name}
            </Link>
          ) : null}{' '}
          <span className="muted">
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time> · {post.readingMinutes} min read
          </span>
        </p>
        <h1 className="h1 m0" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="lead m0 muted" style={{ maxWidth: '52ch' }}>
            {post.excerpt}
          </p>
        ) : null}
        <div className="row-8">
          {post.visibility !== 'public' ? <VisibilityBadge mode={post.visibility} /> : null}
          {post.tags.map((t) => (
            <Link key={t} href={`/blogs?tag=${t}`} className="small" style={{ textDecoration: 'none' }}>
              #{t}
            </Link>
          ))}
        </div>
      </header>

      <div className="post-layout">
        <div className="post-body" id="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
        {post.toc.length > 1 ? (
          <nav className="post-toc" aria-label="On this page">
            <span className="small muted" style={{ display: 'block', margin: '4px 0 6px' }}>
              On this page
            </span>
            {post.toc.map((t) => (
              <a key={t.id} href={`#${t.id}`} className={t.level === 3 ? 'l3' : undefined}>
                {t.text}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
      <PostEnhancer postId={post.id} />
    </article>
  )
}
