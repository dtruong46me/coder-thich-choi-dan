'use server'

import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { requireOwner } from '../access'
import { withScope } from '../db/client'
import { media } from '../db/schema'
import { mediaSrc, presignUpload } from '../storage'
import { uploadInput } from '../validation'
import { run } from './result'

const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'application/pdf': 'pdf',
}

/**
 * Step 1 of an upload: a presigned PUT straight to R2 (5 minutes, fixed type and size).
 * Diary images go to the private bucket. The browser strips EXIF (including GPS) before uploading.
 */
export async function createUploadUrl(raw: z.input<typeof uploadInput>) {
  return run(async () => {
    await requireOwner()
    const input = uploadInput.parse(raw)
    const key = `${input.bucket === 'private' ? 'p' : 'u'}/${new Date().toISOString().slice(0, 7)}/${uuidv7()}.${EXT[input.mime]}`
    const url = await presignUpload({ key, mime: input.mime, bytes: input.bytes, bucket: input.bucket })
    return { ok: true, key, url }
  })
}

const confirmInput = z.object({
  key: z.string().regex(/^[pu]\/\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z]{3,4}$/),
  mime: uploadInput.shape.mime,
  bytes: uploadInput.shape.bytes,
  width: z.number().int().positive().max(20000).nullable(),
  height: z.number().int().positive().max(20000).nullable(),
  blurhash: z.string().max(120).nullable(),
  alt: z.string().max(300).default(''),
})

/** Step 2: record the uploaded file. Returns the src the editor should use. */
export async function confirmUpload(raw: z.input<typeof confirmInput>) {
  return run(async () => {
    const owner = await requireOwner()
    const input = confirmInput.parse(raw)
    const bucket = input.key.startsWith('p/') ? 'private' : 'public'
    const row = await withScope({ role: 'owner', userId: owner.userId }, async (tx) => {
      const [m] = await tx
        .insert(media)
        .values({ storageKey: input.key, bucket, mime: input.mime, bytes: input.bytes, width: input.width, height: input.height, blurhash: input.blurhash, alt: input.alt })
        .onConflictDoNothing()
        .returning()
      return m ?? (await tx.query.media.findFirst({ where: eq(media.storageKey, input.key) }))
    })
    if (!row) return { ok: false, error: 'Upload not found.' }
    return { ok: true, id: row.id, src: mediaSrc(row) }
  })
}
