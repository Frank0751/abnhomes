'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { toMinor } from '@/lib/core/money'

export type AssetActionResult = { ok: true; message: string } | { ok: false; error: string }

const assetSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  name: z.string().min(2, 'What is the asset?'),
  category: z.string().max(60).optional(),
  brand: z.string().max(80).optional(),
  serial: z.string().max(80).optional(),
  value: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export async function createAssetAction(formData: FormData): Promise<AssetActionResult> {
  const actor = await requirePermission('maintenance:manage')
  const parsed = assetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }

  assertCanOnProperty(actor, 'maintenance:manage', parsed.data.propertyId)

  const asset = await db.asset.create({
    data: {
      propertyId: parsed.data.propertyId,
      unitId: parsed.data.unitId || null,
      name: parsed.data.name,
      category: parsed.data.category || null,
      brand: parsed.data.brand || null,
      serial: parsed.data.serial || null,
      valueMinor: parsed.data.value ? toMinor(Number(parsed.data.value), 'GHS') : null,
      notes: parsed.data.notes || null,
    },
  })

  await logAudit({
    actor,
    action: 'asset.created',
    entityType: 'Asset',
    entityId: asset.id,
    after: { name: asset.name },
  })
  revalidatePath('/admin/assets')
  return { ok: true, message: `${asset.name} added to the register.` }
}

const scheduleSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  name: z.string().min(2),
  description: z.string().max(500).optional(),
  category: z.string().min(1),
  priority: z.string().min(1),
  intervalDays: z.coerce.number().int().min(7).max(365),
  leadDays: z.coerce.number().int().min(0).max(30),
})

export async function createScheduleAction(formData: FormData): Promise<AssetActionResult> {
  const actor = await requirePermission('maintenance:manage')
  const parsed = scheduleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }

  assertCanOnProperty(actor, 'maintenance:manage', parsed.data.propertyId)

  const nextDueAt = new Date()
  nextDueAt.setDate(nextDueAt.getDate() + parsed.data.intervalDays)

  const schedule = await db.preventiveMaintenance.create({
    data: {
      propertyId: parsed.data.propertyId,
      unitId: parsed.data.unitId || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category as never,
      priority: parsed.data.priority as never,
      intervalDays: parsed.data.intervalDays,
      leadDays: parsed.data.leadDays,
      nextDueAt,
    },
  })

  await logAudit({
    actor,
    action: 'preventive.created',
    entityType: 'PreventiveMaintenance',
    entityId: schedule.id,
    after: { name: schedule.name, intervalDays: schedule.intervalDays },
  })
  revalidatePath('/admin/assets')
  return { ok: true, message: `${schedule.name} scheduled every ${schedule.intervalDays} days.` }
}

/** Pause or resume a servicing schedule. */
export async function toggleScheduleAction(id: string): Promise<AssetActionResult> {
  const actor = await requirePermission('maintenance:manage')

  const schedule = await db.preventiveMaintenance.findUniqueOrThrow({ where: { id } })
  assertCanOnProperty(actor, 'maintenance:manage', schedule.propertyId)

  await db.preventiveMaintenance.update({ where: { id }, data: { active: !schedule.active } })
  await logAudit({
    actor,
    action: schedule.active ? 'preventive.paused' : 'preventive.resumed',
    entityType: 'PreventiveMaintenance',
    entityId: id,
  })
  revalidatePath('/admin/assets')
  return { ok: true, message: schedule.active ? `${schedule.name} paused.` : `${schedule.name} resumed.` }
}
