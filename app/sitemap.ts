import type { MetadataRoute } from 'next'
import { getPublicIndex } from '@/lib/db/queries/public'
import { absoluteUrl } from '@/lib/site'

// Public posts only: Unlisted, Members, Shared and Private pages never appear here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublicIndex()
  return [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/blogs'), changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/projects'), changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/about'), changeFrequency: 'yearly', priority: 0.5 },
    ...posts.map((p) => ({ url: absoluteUrl(`/blogs/${p.slug}`), lastModified: p.updatedAt, priority: 0.7 })),
  ]
}
