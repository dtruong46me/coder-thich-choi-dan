import type { Card, CollectionSummary } from './db/queries/public'
import { COLLECTION_TOPIC, TOPICS } from './site'

/** Counts per collection, from the listing (public posts and locked cards alike). */
export function collectionCounts(cards: Card[]) {
  const counts = new Map<string, number>()
  for (const c of cards) if (c.collection) counts.set(c.collection.slug, (counts.get(c.collection.slug) ?? 0) + 1)
  return counts
}

export const isPrivateCollection = (c: Pick<CollectionSummary, 'defaultVisibility'>) => c.defaultVisibility === 'private'

export const countLabel = (n: number, diary: boolean) => (diary ? `${n} ${n === 1 ? 'entry' : 'entries'}` : `${n} ${n === 1 ? 'post' : 'posts'}`)

export const topicsFor = (collections: CollectionSummary[]) =>
  TOPICS.filter((t) => collections.some((c) => COLLECTION_TOPIC[c.slug] === t))
