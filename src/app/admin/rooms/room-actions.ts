'use server'

/**
 * Creating and describing rooms.
 *
 * Until this existed, a new room, a corrected description or a fresh set of
 * photos meant a developer editing a seed file or the database by hand. These
 * actions put that in the hands of whoever runs the building, with the same
 * permission that already governs rates and managers: `units:write`, checked
 * against the room's own building.
 *
 * Every change is written to the audit log with what it was before, so a
 * listing that changes unexpectedly can always be traced and put back.
 */

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { Currency, LettingMode, UnitType } from '@prisma/client'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { AccessError, assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { deleteStoredPhoto, isStoredPhoto, storePhoto, StorageNotConfiguredError } from '@/lib/storage'

export type RoomResult =
  | { ok: true; message: string }
  | { ok: false; error: string; values?: Record<string, string> }

export type PhotoResult = { ok: true; images: string[] } | { ok: false; error: string }

const MAX_PHOTOS = 30
/** The browser resizes before sending; anything bigger did not come from our form. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

const UNIT_TYPES = [
  'STUDIO', 'ONE_BED', 'TWO_BED', 'THREE_BED', 'FOUR_BED',
  'PENTHOUSE', 'TOWNHOUSE', 'DETACHED', 'COMMERCIAL',
] as const satisfies readonly UnitType[]
const LETTING_MODES = ['SHORT_STAY', 'LONG_LET', 'BOTH'] as const satisfies readonly LettingMode[]

// ----------------------------------------------------------------- helpers

function rawValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

/** Our own messages are written to be read; anything else names tables and columns. */
function present(error: unknown, fallback: string, values?: Record<string, string>): RoomResult {
  const ours =
    error instanceof AccessError ||
    error instanceof StorageNotConfiguredError ||
    (error instanceof Error && error.constructor === Error)
  if (ours) return { ok: false, error: (error as Error).message, values }
  console.error('[rooms] failed', error)
  return { ok: false, error: fallback, values }
}

/** One item per line, blank lines and duplicates dropped, order kept. */
function lines(raw: string | undefined, max: number, label: string): string[] {
  const items = (raw ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const unique = [...new Set(items)]
  if (unique.length > max) throw new Error(`Keep ${label} to ${max} lines or fewer.`)
  for (const item of unique) {
    if (item.length > 120) throw new Error(`"${item.slice(0, 40)}…" is too long for ${label} — keep each line under 120 characters.`)
  }
  return unique
}

const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce
      .number({ message: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(min, `${label} cannot be below ${min}.`)
      .max(max, `${label} cannot be above ${max}.`)
      .optional()
  )

const requiredInt = (min: number, max: number, label: string) =>
  z.coerce
    .number({ message: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} cannot be below ${min}.`)
    .max(max, `${label} cannot be above ${max}.`)

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || undefined : undefined),
    z.string().max(max, `Keep it under ${max} characters.`).optional()
  )

const time = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Times are written like 14:00.').optional()
)

const flag = z.preprocess((v) => v === 'on' || v === 'true', z.boolean())

/**
 * Bring every public page that shows rooms up to date: the booking page, the
 * home page's live homes, each stay page and the sitemap. Rooms change rarely
 * and the site is small, so revalidating the whole tree is cheaper than
 * keeping a list of every page that shows a room and getting it wrong.
 */
function refreshPublicSite(unitId: string) {
  revalidatePath('/', 'layout')
  revalidatePath('/admin/rooms')
  revalidatePath(`/admin/rooms/${unitId}`)
}

async function unitForWrite(unitId: string) {
  const actor = await requireActor()
  const unit = await db.unit.findUniqueOrThrow({
    where: { id: unitId },
    include: { property: { select: { slug: true } } },
  })
  assertCanOnProperty(actor, 'units:write', unit.propertyId)
  return { actor, unit }
}

// ---------------------------------------------------------------- creating

const createSchema = z.object({
  propertyId: z.string().min(1, 'Choose the building.'),
  code: z
    .string()
    .trim()
    .min(1, 'Give the room a short code, like 8 or B3.')
    .max(12, 'Keep the code to 12 characters.')
    .regex(/^[A-Za-z0-9-]+$/, 'The code can only use letters, numbers and hyphens — it becomes part of the room’s web address.'),
  name: z.string().trim().min(2, 'Give the room a name.').max(80, 'Keep the name under 80 characters.'),
  type: z.enum(UNIT_TYPES),
  lettingMode: z.enum(LETTING_MODES),
  bedrooms: requiredInt(0, 20, 'Bedrooms'),
  bathrooms: requiredInt(0, 20, 'Bathrooms'),
  maxGuests: requiredInt(1, 40, 'Guests'),
  currency: z.enum(['GHS', 'USD']),
})

export async function createRoomAction(_prev: RoomResult | null, formData: FormData): Promise<RoomResult> {
  const values = rawValues(formData)
  let unitId: string

  try {
    const actor = await requireActor()
    const parsed = createSchema.safeParse(values)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the details.', values }
    }
    const input = parsed.data
    assertCanOnProperty(actor, 'units:write', input.propertyId)

    const property = await db.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, slug: true, name: true },
    })
    if (!property) throw new Error('That building no longer exists.')

    const code = input.code.toUpperCase()
    const clash = await db.unit.findFirst({
      where: { propertyId: property.id, code: { equals: code, mode: 'insensitive' } },
      select: { name: true },
    })
    if (clash) throw new Error(`${property.name} already has a room with the code ${code} (${clash.name}).`)

    // The room's public address is built from the building and the code. If
    // another listing already holds that address explicitly, say so now
    // rather than fail on the unique index.
    const slug = `${property.slug}-${code.toLowerCase()}`
    const slugTaken = await db.unit.findFirst({ where: { slug }, select: { name: true } })
    if (slugTaken) throw new Error(`The web address /stays/${slug} is already used by ${slugTaken.name}. Choose another code.`)

    const last = await db.unit.aggregate({ where: { propertyId: property.id }, _max: { sortOrder: true } })

    const unit = await db.unit.create({
      data: {
        propertyId: property.id,
        code,
        name: input.name,
        type: input.type,
        lettingMode: input.lettingMode,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        maxGuests: input.maxGuests,
        currency: input.currency as Currency,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        // Hidden until it has photos, a description and a price. Publishing
        // is a deliberate step on the edit page, which checks all three.
        published: false,
        // Instant book only makes sense once someone has looked at the
        // room's rates; a new room waits for approval until they do.
        instantBook: false,
      },
      select: { id: true },
    })
    unitId = unit.id

    await logAudit({
      actor,
      action: 'room.created',
      entityType: 'Unit',
      entityId: unit.id,
      after: { ...input, code },
    })

    refreshPublicSite(unit.id)
  } catch (error) {
    return present(error, 'Could not create the room.', values)
  }

  // Straight on to photos and details — a room nobody can see yet is only
  // half made. redirect() throws, so it must sit outside the try.
  redirect(`/admin/rooms/${unitId}/edit?created=1`)
}

// ----------------------------------------------------------------- details

const detailsSchema = z.object({
  name: z.string().trim().min(2, 'Give the room a name.').max(80, 'Keep the name under 80 characters.'),
  type: z.enum(UNIT_TYPES),
  lettingMode: z.enum(LETTING_MODES),
  floor: optionalInt(-5, 200, 'Floor'),
  bedrooms: requiredInt(0, 20, 'Bedrooms'),
  bathrooms: requiredInt(0, 20, 'Bathrooms'),
  maxGuests: requiredInt(1, 40, 'Guests'),
  sizeSqm: optionalInt(1, 100_000, 'Size'),
  description: optionalText(4000),
  features: z.string().optional(),
  houseRules: z.string().optional(),
  checkInFrom: time,
  checkOutUntil: time,
  selfCheckIn: flag,
  deskSpace: flag,
  wifiName: optionalText(60),
  wifiPassword: optionalText(60),
  wifiSpeedMbps: optionalInt(1, 10_000, 'Wi-Fi speed'),
  backupPower: z.enum(['', 'generator', 'inverter', 'solar hybrid', 'none']).optional(),
  waterStorageLitres: optionalInt(0, 1_000_000, 'Water storage'),
  securityNotes: optionalText(500),
  transitNotes: optionalText(500),
  licenseNumber: optionalText(60),
  published: flag,
})

export async function updateRoomDetailsAction(
  unitId: string,
  _prev: RoomResult | null,
  formData: FormData
): Promise<RoomResult> {
  const values = rawValues(formData)
  try {
    const { actor, unit } = await unitForWrite(unitId)

    const parsed = detailsSchema.safeParse(values)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the details.', values }
    }
    const input = parsed.data
    const features = lines(input.features, 40, 'features')
    const houseRules = lines(input.houseRules, 30, 'house rules')

    if (input.published && !unit.published) {
      // Publishing puts the room in front of guests and opens it to bookings,
      // so it has to be fit to be seen and possible to price.
      const missing: string[] = []
      if (unit.isAmenity) throw new Error(`${unit.name} is shared space and cannot be listed on its own.`)
      if (unit.images.length === 0) missing.push('at least one photo')
      if (!input.description) missing.push('a description')
      const hasRate =
        unit.baseNightlyMinor != null ||
        unit.baseRentMinor != null ||
        (await db.ratePlan.count({ where: { unitId, active: true } })) > 0
      if (!hasRate) missing.push('a rate (set it on the room’s page under Rates)')
      if (missing.length > 0) {
        return { ok: false, error: `Before it goes live the room needs ${missing.join(', ')}.`, values }
      }
    }

    const data = {
      name: input.name,
      type: input.type,
      lettingMode: input.lettingMode,
      floor: input.floor ?? null,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      maxGuests: input.maxGuests,
      sizeSqm: input.sizeSqm ?? null,
      description: input.description ?? null,
      features,
      houseRules,
      checkInFrom: input.checkInFrom ?? null,
      checkOutUntil: input.checkOutUntil ?? null,
      selfCheckIn: input.selfCheckIn,
      deskSpace: input.deskSpace,
      wifiName: input.wifiName ?? null,
      wifiPassword: input.wifiPassword ?? null,
      wifiSpeedMbps: input.wifiSpeedMbps ?? null,
      backupPower: input.backupPower || null,
      waterStorageLitres: input.waterStorageLitres ?? null,
      securityNotes: input.securityNotes ?? null,
      transitNotes: input.transitNotes ?? null,
      licenseNumber: input.licenseNumber ?? null,
      published: unit.isAmenity ? false : input.published,
    }

    await db.unit.update({ where: { id: unitId }, data })

    // The Wi-Fi password is kept out of the audit trail: the log is read by
    // more people than should be able to get on the network.
    const redact = <T extends { wifiPassword?: string | null }>(o: T) => ({
      ...o,
      wifiPassword: o.wifiPassword ? '•••' : null,
    })
    const before = Object.fromEntries(
      Object.keys(data).map((k) => [k, (unit as Record<string, unknown>)[k] ?? null])
    ) as typeof data
    await logAudit({
      actor,
      action: 'room.details_updated',
      entityType: 'Unit',
      entityId: unitId,
      before: redact(before),
      after: redact(data),
    })

    refreshPublicSite(unitId)

    const wentLive = data.published && !unit.published
    const wentDark = !data.published && unit.published
    return {
      ok: true,
      message: wentLive
        ? `${data.name} is saved and now live on the website.`
        : wentDark
          ? `${data.name} is saved and hidden from the website.`
          : `${data.name} is saved.`,
    }
  } catch (error) {
    return present(error, 'Could not save the room.', values)
  }
}

// ------------------------------------------------------------------ photos

/** The first bytes of every JPEG, PNG and WebP file. Checked, not trusted from the browser. */
function sniff(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  return null
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const

/**
 * Add one photo to the end of a room's gallery.
 *
 * One file per call, on purpose: the browser resizes each photo before
 * sending it, and a request carrying ten of them would exceed what a
 * serverless function accepts. The photo manager sends them one after
 * another, so they also land in the order they were chosen.
 */
export async function uploadRoomPhotoAction(unitId: string, formData: FormData): Promise<PhotoResult> {
  try {
    const { actor, unit } = await unitForWrite(unitId)

    const file = formData.get('photo')
    if (!(file instanceof File) || file.size === 0) throw new Error('Choose a photo to upload.')
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('That photo is too large. Try a smaller one.')
    if (unit.images.length >= MAX_PHOTOS) {
      throw new Error(`A room can show up to ${MAX_PHOTOS} photos. Remove one first.`)
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniff(bytes)
    if (!type) throw new Error('That file is not a JPEG, PNG or WebP photo.')

    const url = await storePhoto(`units/${unit.id}/${randomUUID()}.${EXT[type]}`, bytes, type)

    // Append against the current list, not the one read above: another
    // upload may have landed in between.
    const fresh = await db.unit.findUniqueOrThrow({ where: { id: unitId }, select: { images: true } })
    const images = [...fresh.images, url]
    await db.unit.update({ where: { id: unitId }, data: { images } })

    await logAudit({
      actor,
      action: 'room.photo_added',
      entityType: 'Unit',
      entityId: unitId,
      after: { url, count: images.length },
    })

    refreshPublicSite(unitId)
    return { ok: true, images }
  } catch (error) {
    const result = present(error, 'Could not upload that photo.')
    return { ok: false, error: result.ok ? 'Could not upload that photo.' : result.error }
  }
}

/**
 * Save a new order for a room's photos, or remove some.
 *
 * The list sent back must be drawn from the photos the room already has: this
 * reorders and removes, it never adds. Otherwise anyone able to edit a room
 * could put an arbitrary address on the public site.
 */
export async function saveRoomPhotosAction(unitId: string, images: string[]): Promise<PhotoResult> {
  try {
    const { actor, unit } = await unitForWrite(unitId)

    if (!Array.isArray(images) || images.some((i) => typeof i !== 'string')) {
      throw new Error('That photo list was not understood.')
    }
    const current = new Set(unit.images)
    if (images.some((i) => !current.has(i))) {
      throw new Error('The photos changed while you were editing. Reload the page and try again.')
    }
    const next = [...new Set(images)]

    if (unit.published && next.length === 0) {
      throw new Error('A room on the website needs at least one photo. Hide the room first if you want to remove them all.')
    }

    await db.unit.update({ where: { id: unitId }, data: { images: next } })

    const removed = unit.images.filter((i) => !next.includes(i))
    await logAudit({
      actor,
      action: removed.length > 0 ? 'room.photos_removed' : 'room.photos_reordered',
      entityType: 'Unit',
      entityId: unitId,
      before: { images: unit.images },
      after: { images: next },
    })

    // Only after the room no longer points at them. Photos that shipped with
    // the site are left alone; only uploaded ones are deleted.
    await Promise.all(removed.filter(isStoredPhoto).map(deleteStoredPhoto))

    refreshPublicSite(unitId)
    return { ok: true, images: next }
  } catch (error) {
    const result = present(error, 'Could not save the photos.')
    return { ok: false, error: result.ok ? 'Could not save the photos.' : result.error }
  }
}
