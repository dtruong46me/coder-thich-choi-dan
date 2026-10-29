import { ImageResponse } from 'next/og'
import { cacheLife } from 'next/cache'
import { getPublicPost } from '@/lib/db/queries/public'

const size = { width: 1200, height: 630 }

/** Loads just the glyphs we need from Google Fonts so Vietnamese titles render correctly. */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  'use cache'
  cacheLife('max')
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@600&text=${encodeURIComponent(text)}`)
    ).text()
    const url = /src: url\((.+?)\) format\('(opentype|truetype)'\)/.exec(css)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch {
    return null
  }
}

// Share images for Public posts only. Warmed by the publish job; cached until the post changes.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPublicPost(slug)
  const title = post?.title ?? 'Coder thích chơi đàn'
  const kicker = post?.collection?.name ?? '@coderthichchoidan'
  const font = await loadFont(`${title}${kicker}Coder thích chơi đàn c♪`)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#f6f3ec', color: '#22201c', fontFamily: 'BVP' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 30, color: '#2f5d46' }}>
          <div style={{ display: 'flex', width: 64, height: 64, borderRadius: 16, background: '#2f5d46', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>c♪</div>
          Coder thích chơi đàn
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 30, color: '#2f5d46' }}>{kicker}</div>
          <div style={{ fontSize: title.length > 60 ? 58 : 72, lineHeight: 1.08, letterSpacing: -1.5 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, background: '#2f5d46', width: 220 }} />
      </div>
    ),
    { ...size, fonts: font ? [{ name: 'BVP', data: font, weight: 600, style: 'normal' }] : undefined },
  )
}
