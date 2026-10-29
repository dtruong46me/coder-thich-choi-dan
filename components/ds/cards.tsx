import Link from 'next/link'
import type { Card } from '@/lib/db/queries/public'
import type { Visibility } from '@/lib/db/schema'
import { formatDate } from '@/lib/format'
import { cx } from './cx'
import { Icon } from './Icon'
import { VisibilityBadge } from './primitives'

const LOCK_MSG: Partial<Record<Visibility, string>> = {
  members: 'Subscribers only. Sign in to read.',
  shared: 'Shared with a few people. Ask me for access.',
  private: 'Private diary. Only the author can read this.',
  unlisted: 'Link only.',
}

/** A post in a list. Locked cards never receive a title, excerpt or tags: only date, collection and mode. */
export function PostCard({ card, variant = 'row', index, showCollection = true }: { card: Card; variant?: 'row' | 'card'; index?: string; showCollection?: boolean }) {
  const date = formatDate(card.publishedAt)
  const href = card.locked ? `/read/${card.id}` : `/blogs/${card.slug}`
  const top = (
    <span className="ct-post-top">
      {showCollection && card.collection ? <span className="ct-post-col">{card.collection.name}</span> : null}
      {card.visibility !== 'public' ? <VisibilityBadge mode={card.visibility} /> : null}
    </span>
  )
  const body = card.locked ? (
    <>
      <span className="ct-post-redact" role="img" aria-label="Hidden title">
        ██████ ████████ ███
      </span>
      <span className="ct-post-lock">
        <Icon name="lock" size={15} />
        {LOCK_MSG[card.visibility] ?? 'Locked.'}
      </span>
    </>
  ) : (
    <>
      <span className="ct-post-title">{card.title}</span>
      {card.excerpt && variant === 'row' ? <span className="ct-post-ex">{card.excerpt}</span> : null}
      {card.tags.length && variant === 'row' ? (
        <span className="ct-post-tags">
          {card.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </span>
      ) : null}
    </>
  )
  const readTime = card.locked ? null : `${card.readingMinutes} min read`

  if (variant === 'card') {
    return (
      <Link className={cx('ct-postcard', card.locked && 'is-locked')} href={href}>
        <span className="ct-postcard-cover" aria-hidden="true">
          <span className="ct-postcard-idx">{index ?? '01'}</span>
        </span>
        <span className="ct-postcard-body">
          {top}
          {body}
          <span className="ct-post-meta">{[date, readTime].filter(Boolean).join(' · ')}</span>
        </span>
      </Link>
    )
  }
  return (
    <Link className={cx('ct-postrow', card.locked && 'is-locked')} href={href}>
      <span className="ct-post-date">{date}</span>
      <span className="ct-postrow-main">
        {top}
        {body}
        {readTime ? <span className="ct-post-meta">{readTime}</span> : null}
      </span>
    </Link>
  )
}
