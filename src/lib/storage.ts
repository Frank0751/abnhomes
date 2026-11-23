/**
 * Photo storage, on Supabase Storage.
 *
 * Neither Vercel nor Cloudflare Workers keeps a file written to disk, so an
 * uploaded room photo has to live somewhere outside the app. Supabase is
 * already the database, so its storage is the natural place: one public
 * bucket, served from Supabase's CDN, written only from the server with the
 * secret key. The browser never holds a key and never writes directly.
 *
 * Plain fetch against the Storage REST API rather than the Supabase SDK, so it
 * runs unchanged on Node and on Workers.
 */

const BUCKET = 'listing-photos'
const MAX_BYTES = 10 * 1024 * 1024

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      'Photo storage is not set up on this deployment: NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must both be set.'
    )
  }
}

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new StorageNotConfiguredError()
  return { url, key }
}

function headers(key: string, extra: Record<string, string> = {}): Record<string, string> {
  // A legacy service-role key is a JWT and goes in Authorization as well. A
  // new-style secret key (sb_secret_…) is not a JWT: the gateway accepts it
  // in `apikey` and mints the token itself, and rejects it as a Bearer.
  return {
    apikey: key,
    ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    ...extra,
  }
}

/** The public address every object in the bucket is served from. */
export function publicPrefix(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  return url ? `${url}/storage/v1/object/public/${BUCKET}/` : null
}

/** True when this URL is a photo we stored, as opposed to one shipped in /public. */
export function isStoredPhoto(url: string): boolean {
  const prefix = publicPrefix()
  return prefix !== null && url.startsWith(prefix)
}

/**
 * Create the bucket the first time a photo is uploaded. Public, because these
 * photos are shown on the public site; size- and type-limited at the bucket so
 * the limits hold even if a bug here let something past.
 */
async function ensureBucket(): Promise<void> {
  const { url, key } = config()
  const response = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: headers(key, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: MAX_BYTES,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  })
  if (response.ok) return
  const text = await response.text()
  // Two uploads racing to create it is fine: the loser sees "already exists".
  if (/already exists|Duplicate/i.test(text)) return
  throw new Error(`Could not create photo storage (${response.status}): ${text.slice(0, 200)}`)
}

/** Store a photo and return its public URL. */
export async function storePhoto(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const { url, key } = config()
  if (bytes.byteLength > MAX_BYTES) throw new Error('That photo is larger than 10 MB.')

  const put = () =>
    fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: headers(key, {
        'Content-Type': contentType,
        // Every upload gets a fresh random name, so the file at a given
        // address never changes and can be cached for a year.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-upsert': 'false',
      }),
      body: bytes as BodyInit,
    })

  let response = await put()
  if (!response.ok) {
    const text = await response.text()
    if (!/bucket not found/i.test(text)) {
      throw new Error(`Could not store the photo (${response.status}): ${text.slice(0, 200)}`)
    }
    await ensureBucket()
    response = await put()
    if (!response.ok) {
      const retry = await response.text()
      throw new Error(`Could not store the photo (${response.status}): ${retry.slice(0, 200)}`)
    }
  }

  return `${publicPrefix()}${path}`
}

/**
 * Remove a stored photo. Best-effort: a photo that cannot be deleted costs a
 * few hundred kilobytes of storage, while failing the edit that removed it
 * from a listing would cost the person their change. Photos shipped with the
 * site (/images/…) are never touched.
 */
export async function deleteStoredPhoto(photoUrl: string): Promise<void> {
  const prefix = publicPrefix()
  if (!prefix || !photoUrl.startsWith(prefix)) return
  try {
    const { url, key } = config()
    const path = photoUrl.slice(prefix.length)
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: headers(key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: [path] }),
    })
    if (!response.ok) console.error('[storage] delete failed', response.status, await response.text())
  } catch (error) {
    console.error('[storage] delete failed', error)
  }
}

// ------------------------------------------------------------ uploads

/** The browser resizes before sending; anything bigger did not come from our forms. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
type ImageType = keyof typeof IMAGE_EXT

/** Trust the bytes, not the name or the declared type. */
function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  return null
}

/**
 * The `photo` field of an upload form, checked: present, small enough, and
 * really a JPEG, PNG or WebP. Throws a message fit to show the person.
 */
export async function readPhotoUpload(
  formData: FormData
): Promise<{ bytes: Uint8Array; type: ImageType; ext: (typeof IMAGE_EXT)[ImageType] }> {
  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a photo to upload.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That photo is too large. Try a smaller one.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffImage(bytes)
  if (!type) throw new Error('That file is not a JPEG, PNG or WebP photo.')
  return { bytes, type, ext: IMAGE_EXT[type] }
}
