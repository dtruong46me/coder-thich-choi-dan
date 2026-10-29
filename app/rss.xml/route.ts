import { getPublicIndex } from '@/lib/db/queries/public'
import { esc } from '@/lib/content/render'
import { absoluteUrl, SITE } from '@/lib/site'

// Public posts only. Prerendered and refreshed whenever the `posts` tag is revalidated.
export async function GET() {
  const posts = await getPublicIndex()
  const items = posts
    .slice(0, 50)
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${absoluteUrl(`/blogs/${p.slug}`)}</link>
      <guid isPermaLink="false">${p.id}</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      ${p.colName ? `<category>${esc(p.colName)}</category>` : ''}
      <description>${esc(p.excerpt)}</description>
    </item>`,
    )
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE.name)}</title>
    <link>${SITE.url}</link>
    <description>${esc(SITE.description)}</description>
    <language>en</language>
    <atom:link href="${absoluteUrl('/rss.xml')}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
