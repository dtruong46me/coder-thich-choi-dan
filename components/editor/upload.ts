'use client'
import { encode } from 'blurhash'
import { confirmUpload, createUploadUrl } from '@/lib/actions/media'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'] as const
const MAX = 10 * 1024 * 1024

type Prepared = { blob: Blob; mime: (typeof ALLOWED)[number]; width: number; height: number; blurhash: string | null }

/**
 * Re-encodes the image through a canvas, which drops EXIF metadata (GPS location included),
 * and computes its size and a blurhash so the page can reserve space (no layout shift).
 * GIFs are uploaded as-is to keep animation.
 */
async function prepare(file: File): Promise<Prepared> {
  if (!ALLOWED.includes(file.type as never)) throw new Error('Use a PNG, JPG, WebP, AVIF or GIF image.')
  if (file.size > MAX) throw new Error('Images can be up to 10 MB.')
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const small = document.createElement('canvas')
  small.width = 32
  small.height = Math.max(1, Math.round((32 * height) / width))
  small.getContext('2d')!.drawImage(bitmap, 0, 0, small.width, small.height)
  let blurhash: string | null = null
  try {
    blurhash = encode(small.getContext('2d')!.getImageData(0, 0, small.width, small.height).data, small.width, small.height, 4, 3)
  } catch {}
  if (file.type === 'image/gif') return { blob: file, mime: 'image/gif', width, height, blurhash }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  const mime = file.type === 'image/png' ? 'image/png' : 'image/webp'
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not read the image.'))), mime, 0.9))
  if (blob.size > MAX) throw new Error('This image is still over 10 MB after compression.')
  return { blob, mime, width, height, blurhash }
}

export async function uploadImage(file: File, bucket: 'public' | 'private') {
  const p = await prepare(file)
  const signed = await createUploadUrl({ filename: file.name, mime: p.mime, bytes: p.blob.size, bucket })
  if (!signed.ok) throw new Error(signed.error)
  const put = await fetch(signed.url, { method: 'PUT', body: p.blob, headers: { 'content-type': p.mime } })
  if (!put.ok) throw new Error('Upload failed. Check the R2 CORS settings.')
  const done = await confirmUpload({ key: signed.key, mime: p.mime, bytes: p.blob.size, width: p.width, height: p.height, blurhash: p.blurhash, alt: '' })
  if (!done.ok) throw new Error(done.error)
  return { mediaId: done.id, src: done.src, width: p.width, height: p.height }
}
