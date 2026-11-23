'use server'

/**
 * Adding a building and keeping what the website says about it up to date.
 *
 * Two levels of permission, on purpose:
 *   - adding a building, or changing who owns it and what ABN charges them,
 *     is `properties:manage` — administrators only, because it changes what
 *     owners are paid;
 *   - the description, photos, area guide and manager are `units:write` on
 *     that building, the same permission that already edits its rooms.
 *
 * Changing the owner or fee never edits the old agreement. It is closed and a
 * new one opened, so statements for earlier months still compute with the
 * terms that applied then.
 */

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireActor, requirePermission } from '@/lib/session'
import { AccessError, assertCanOnProperty, can, isUnscoped } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { lines } from '@/lib/form-lines'
import { normalisePhone } from '@/lib/core/phone'
import {
  deleteStoredPhoto,
  isStoredPhoto,
  readPhotoUpload,
  storePhoto,
  StorageNotConfiguredError,
} from '@/lib/storage'

export type BuildingResult =
  | { ok: true; message: string }
  | { ok: false; error: string; values?: Record<string, string> }

export type BuildingPhotoResult = { ok: true; images: string[] } | { ok: false; error: string }

const MAX_PHOTOS = 30
const NEW_OWNER = '__new'

function rawValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of formData.entries()) if (typeof value === 'string') out[key] = value
  return out
}

function present(error: unknown, fallback: string, values?: Record<string, string>): BuildingResult {
  const ours =
    error instanceof AccessError ||
    error instanceof StorageNotConfiguredError ||
    (error instanceof Error && error.constructor === Error)
  if (ours) return { ok: false, error: (error as Error).message, values }
  console.error('[buildings] failed', error)
  return { ok: false, error: fallback, values }
}

const text = (max: number, label: string, required = false) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || undefined : undefined),
    required
      ? z.string({ message: `${label} is required.` }).max(max, `Keep ${label.toLowerCase()} under ${max} characters.`)
      : z.string().max(max, `Keep ${label.toLowerCase()} under ${max} characters.`).optional()
  )

const coordinate = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number({ message: `${label} must be a number.` }).min(min, `${label} is out of range.`).max(max, `${label} is out of range.`).optional()
  )

/** A management fee, typed as a percentage, stored as basis points. */
const feePercent = z.preprocess(
  (v) => (v === '' || v == null ? 0 : v),
  z.coerce.number({ message: 'The fee must be a number.' }).min(0, 'The fee cannot be negative.').max(60, 'A fee above 60% is almost certainly a typo.')
)

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function refresh(propertyId?: string) {
  revalidatePath('/', 'layout')
  revalidatePath('/admin/portfolio')
  if (propertyId) revalidatePath(`/admin/portfolio/buildings/${propertyId}`)
}

/**
 * Resolve the owner chosen on the form: an existing owner, or a new one
 * created on the spot. Returns the party id.
 */
async function resolveOwner(formData: FormData, tx: Pick<typeof db, 'party'> = db): Promise<string> {
  const choice = String(formData.get('ownerPartyId') ?? '')
  if (choice && choice !== NEW_OWNER) {
    const party = await tx.party.findUnique({ where: { id: choice }, select: { id: true } })
    if (!party) throw new Error('That owner no longer exists. Reload and try again.')
    return party.id
  }

  const name = String(formData.get('newOwnerName') ?? '').trim()
  if (name.length < 2) throw new Error('Enter the new owner’s name.')
  const rawPhone = String(formData.get('newOwnerPhone') ?? '').trim()
  const phone = rawPhone ? normalisePhone(rawPhone) : null
  if (rawPhone && !phone) throw new Error('The owner’s phone number does not look right.')
  const email = String(formData.get('newOwnerEmail') ?? '').trim().toLowerCase() || null
  if (email && !z.string().email().safeParse(email).success) throw new Error('The owner’s email does not look right.')

  const party = await tx.party.create({
    data: { name, phone, email, isOwner: true, type: /\b(ltd|limited|company|plc|llc)\b/i.test(name) ? 'COMPANY' : 'PERSON' },
  })
  return party.id
}

// ------------------------------------------------------------------ create

export async function createBuildingAction(_prev: BuildingResult | null, formData: FormData): Promise<BuildingResult> {
  const values = rawValues(formData)
  let id: string
  try {
    const actor = await requirePermission('properties:manage')

    const parsed = z
      .object({
        name: text(80, 'Name', true),
        addressLine: text(160, 'Address', true),
        neighbourhood: text(60, 'Neighbourhood'),
        city: text(60, 'City', true),
        region: text(60, 'Region', true),
        fee: feePercent,
      })
      .safeParse(values)
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the form.')
    const input = parsed.data

    const slug = slugify(String(values.slug || input.name))
    if (slug.length < 3) throw new Error('The web address needs at least 3 letters or numbers.')
    if (await db.property.findUnique({ where: { slug } })) {
      throw new Error(`Another building already uses the web address “${slug}”. Choose a different one.`)
    }

    const property = await db.$transaction(async (tx) => {
      const ownerPartyId = await resolveOwner(formData, tx)
      const created = await tx.property.create({
        data: {
          slug,
          name: input.name!,
          addressLine: input.addressLine!,
          neighbourhood: input.neighbourhood ?? null,
          city: input.city!,
          region: input.region!,
          ownerPartyId,
          published: false,
          active: true,
        },
      })
      // Every building has an agreement, ABN's own included at 0%, so that
      // every statement reconciles through the same code.
      await tx.managementAgreement.create({
        data: {
          propertyId: created.id,
          ownerPartyId,
          feeBasisPoints: Math.round(input.fee * 100),
          startDate: new Date(),
        },
      })
      return created
    })
    id = property.id

    await logAudit({
      actor,
      action: 'property.created',
      entityType: 'Property',
      entityId: property.id,
      after: { name: property.name, slug, ownerPartyId: property.ownerPartyId, feePercent: input.fee },
    })
    refresh()
  } catch (error) {
    return present(error, 'Could not add the building.', values)
  }
  redirect(`/admin/portfolio/buildings/${id}?created=1`)
}

// ------------------------------------------------------------------ update

export async function updateBuildingAction(
  propertyId: string,
  _prev: BuildingResult | null,
  formData: FormData
): Promise<BuildingResult> {
  const values = rawValues(formData)
  try {
    const actor = await requireActor()
    assertCanOnProperty(actor, 'units:write', propertyId)

    const property = await db.property.findUnique({
      where: { id: propertyId },
      include: { agreements: { where: { active: true }, orderBy: { startDate: 'desc' }, take: 1 } },
    })
    if (!property) throw new Error('That building no longer exists.')

    const parsed = z
      .object({
        name: text(80, 'Name', true),
        addressLine: text(160, 'Address', true),
        neighbourhood: text(60, 'Neighbourhood'),
        city: text(60, 'City', true),
        region: text(60, 'Region', true),
        latitude: coordinate(-90, 90, 'Latitude'),
        longitude: coordinate(-180, 180, 'Longitude'),
        description: text(4000, 'Description'),
        aboutArea: text(2000, 'About the area'),
      })
      .safeParse(values)
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the form.')
    const input = parsed.data
    if ((input.latitude === undefined) !== (input.longitude === undefined)) {
      throw new Error('Enter both latitude and longitude, or neither.')
    }
    const amenities = lines(values.amenities, 40, 'amenities')
    const published = values.published === 'on'

    // Manager: an active property manager or administrator, who must also be
    // able to see the building they are put in charge of.
    const managerId = values.managerId || null
    if (managerId) {
      const manager = await db.user.findUnique({ where: { id: managerId } })
      if (!manager || !manager.active || manager.suspendedAt || !['PROPERTY_MANAGER', 'SUPER_ADMIN'].includes(manager.role)) {
        throw new Error('Choose an active property manager or administrator as the manager.')
      }
    }

    const data = {
      name: input.name!,
      addressLine: input.addressLine!,
      neighbourhood: input.neighbourhood ?? null,
      city: input.city!,
      region: input.region!,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      description: input.description ?? null,
      aboutArea: input.aboutArea ?? null,
      amenities,
      managerId,
      published,
    }

    // Owner and fee: only for those allowed, and only when actually changed.
    const current = property.agreements[0]
    let ownerChange: { ownerPartyId: string; feeBasisPoints: number } | null = null
    if (can(actor, 'properties:manage') && values.ownerPartyId !== undefined) {
      const fee = feePercent.safeParse(values.fee)
      if (!fee.success) throw new Error(fee.error.issues[0]?.message ?? 'Check the fee.')
      const feeBasisPoints = Math.round(fee.data * 100)
      const ownerChosen = values.ownerPartyId === NEW_OWNER ? NEW_OWNER : values.ownerPartyId
      if (ownerChosen !== property.ownerPartyId || feeBasisPoints !== (current?.feeBasisPoints ?? -1)) {
        ownerChange = { ownerPartyId: ownerChosen, feeBasisPoints }
      }
    }

    await db.$transaction(async (tx) => {
      let ownerPartyId = property.ownerPartyId
      if (ownerChange) {
        ownerPartyId =
          ownerChange.ownerPartyId === NEW_OWNER || ownerChange.ownerPartyId !== property.ownerPartyId
            ? await resolveOwner(formData, tx)
            : property.ownerPartyId
        const now = new Date()
        await tx.managementAgreement.updateMany({
          where: { propertyId, active: true },
          data: { active: false, endDate: now },
        })
        await tx.managementAgreement.create({
          data: {
            propertyId,
            ownerPartyId,
            feeBasisPoints: ownerChange.feeBasisPoints,
            payoutSchedule: current?.payoutSchedule,
            deductExpenses: current?.deductExpenses,
            currency: current?.currency,
            terms: current?.terms,
            startDate: now,
          },
        })
      }
      await tx.property.update({ where: { id: propertyId }, data: { ...data, ownerPartyId } })

      if (managerId) {
        const manager = await tx.user.findUniqueOrThrow({ where: { id: managerId }, select: { role: true } })
        if (!isUnscoped(manager.role)) {
          await tx.userPropertyAccess.upsert({
            where: { userId_propertyId: { userId: managerId, propertyId } },
            create: { userId: managerId, propertyId },
            update: {},
          })
        }
      }
    })

    await logAudit({
      actor,
      action: 'property.updated',
      entityType: 'Property',
      entityId: propertyId,
      before: {
        name: property.name,
        addressLine: property.addressLine,
        neighbourhood: property.neighbourhood,
        published: property.published,
        managerId: property.managerId,
        ownerPartyId: property.ownerPartyId,
        feeBasisPoints: current?.feeBasisPoints,
      },
      after: { ...data, ...(ownerChange ? { feeBasisPoints: ownerChange.feeBasisPoints, ownerChanged: true } : {}) },
    })

    refresh(propertyId)
    const notes = [
      ownerChange ? 'A new management agreement starts today; earlier statements keep the old terms.' : null,
      property.published && !published ? 'The building and all its rooms are now hidden from the website.' : null,
    ].filter(Boolean)
    return { ok: true, message: ['Building saved.', ...notes].join(' ') }
  } catch (error) {
    return present(error, 'Could not save the building.', values)
  }
}

// ------------------------------------------------------------------ photos

async function propertyForWrite(propertyId: string) {
  const actor = await requireActor()
  assertCanOnProperty(actor, 'units:write', propertyId)
  const property = await db.property.findUnique({ where: { id: propertyId } })
  if (!property) throw new Error('That building no longer exists.')
  return { actor, property }
}

function photoError(error: unknown, fallback: string): BuildingPhotoResult {
  const result = present(error, fallback)
  return { ok: false, error: result.ok ? fallback : result.error }
}

export async function uploadBuildingPhotoAction(propertyId: string, formData: FormData): Promise<BuildingPhotoResult> {
  try {
    const { actor, property } = await propertyForWrite(propertyId)
    if (property.images.length >= MAX_PHOTOS) throw new Error(`A building can show up to ${MAX_PHOTOS} photos. Remove one first.`)

    const { bytes, type, ext } = await readPhotoUpload(formData)
    const url = await storePhoto(`properties/${property.id}/${randomUUID()}.${ext}`, bytes, type)

    const fresh = await db.property.findUniqueOrThrow({ where: { id: propertyId }, select: { images: true } })
    const images = [...fresh.images, url]
    await db.property.update({ where: { id: propertyId }, data: { images } })

    await logAudit({ actor, action: 'property.photo_added', entityType: 'Property', entityId: propertyId, after: { url, count: images.length } })
    refresh(propertyId)
    return { ok: true, images }
  } catch (error) {
    return photoError(error, 'Could not upload that photo.')
  }
}

/** Reorder or remove only: the list must come from photos the building already has. */
export async function saveBuildingPhotosAction(propertyId: string, images: string[]): Promise<BuildingPhotoResult> {
  try {
    const { actor, property } = await propertyForWrite(propertyId)
    if (!Array.isArray(images) || images.some((i) => typeof i !== 'string')) throw new Error('That photo list was not understood.')
    const current = new Set(property.images)
    if (images.some((i) => !current.has(i))) throw new Error('The photos changed while you were editing. Reload the page and try again.')
    const next = [...new Set(images)]

    await db.property.update({ where: { id: propertyId }, data: { images: next } })
    const removed = property.images.filter((i) => !next.includes(i))
    await logAudit({
      actor,
      action: removed.length > 0 ? 'property.photos_removed' : 'property.photos_reordered',
      entityType: 'Property',
      entityId: propertyId,
      before: { images: property.images },
      after: { images: next },
    })
    await Promise.all(removed.filter(isStoredPhoto).map(deleteStoredPhoto))

    refresh(propertyId)
    return { ok: true, images: next }
  } catch (error) {
    return photoError(error, 'Could not save the photos.')
  }
}
