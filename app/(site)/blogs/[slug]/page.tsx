import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PostView } from '@/components/site/PostView'
import { getViewer } from '@/lib/access'
import { getPublicIndex, getPublicPost } from '@/lib/db/queries/public'
import { getPostForViewer } from '@/lib/db/queries/viewer'

type Props = { params: Promise<{ slug: string }> }

// Public posts are prerendered at build and again whenever they are republished (cache tag post:<id>).
export async function generateStaticParams() {
  const posts = await getPublicIndex()
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: 'hello' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublicPost(slug)
  if (!post) return { title: 'Post', robots: { index: false, follow: false } }
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blogs/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: post.excerpt, publishedTime: post.publishedAt, images: [`/og/${post.slug}`] },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt, images: [`/og/${post.slug}`] },
  }
}

export default function PostPage({ params }: Props) {
  return (
    <Suspense fallback={<PostSkeleton />}>
      <Resolve params={params} />
    </Suspense>
  )
}

async function Resolve({ params }: Props) {
  const { slug } = await params
  const post = await getPublicPost(slug)
  if (post) return <PostView post={post} />
  // Not public: check who is asking. This branch is dynamic and never enters a shared cache.
  return (
    <Suspense fallback={<PostSkeleton />}>
      <ViewerPost slug={slug} />
    </Suspense>
  )
}

async function ViewerPost({ slug }: { slug: string }) {
  const viewer = await getViewer()
  const post = await getPostForViewer(viewer, slug)
  if (!post) notFound()
  return <PostView post={post} />
}

function PostSkeleton() {
  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 72 }} aria-busy="true">
      <p className="small muted">Loading…</p>
    </div>
  )
}
