import 'server-only'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const UPLOAD_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'application/pdf'] as const
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024

let client: S3Client | null = null
function s3() {
  if (!process.env.R2_ACCOUNT_ID) throw new Error('R2 is not configured (R2_ACCOUNT_ID).')
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  return client
}

export const bucketName = (bucket: 'public' | 'private') =>
  bucket === 'public' ? (process.env.R2_PUBLIC_BUCKET ?? 'ctcd-public') : (process.env.R2_PRIVATE_BUCKET ?? 'ctcd-private')

/** Direct browser -> R2 upload, valid for 5 minutes, locked to one key, type and size. */
export async function presignUpload(opts: { key: string; mime: string; bytes: number; bucket: 'public' | 'private' }) {
  const cmd = new PutObjectCommand({
    Bucket: bucketName(opts.bucket),
    Key: opts.key,
    ContentType: opts.mime,
    ContentLength: opts.bytes,
  })
  return getSignedUrl(s3(), cmd, { expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length']) })
}

/** Private diary images: a signed GET that lives 5 minutes, handed out only after canRead(). */
export async function signedGetUrl(key: string, bucket: 'public' | 'private' = 'private') {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }), { expiresIn: 300 })
}

/** Public-bucket files are served straight from the R2 custom domain; everything else goes through /api/media/<id>. */
export const mediaSrc = (m: { id: string; storageKey: string; bucket: 'public' | 'private' }) =>
  m.bucket === 'public' && process.env.R2_PUBLIC_HOST
    ? `https://${process.env.R2_PUBLIC_HOST}/${m.storageKey}`
    : `/api/media/${m.id}`
