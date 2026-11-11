'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export type UserActionResult = { ok: true; message: string } | { ok: false; error: string }

/** Suspend a user: they cannot sign in, and their access stops mattering. */
export async function suspendUserAction(userId: string, reason: string): Promise<UserActionResult> {
  const actor = await requirePermission('users:manage')
  if (userId === actor.id) return { ok: false, error: 'You cannot suspend yourself.' }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.suspendedAt) return { ok: false, error: 'Already suspended.' }

  await db.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspensionReason: reason || null },
  })
  await logAudit({
    actor,
    action: 'user.suspended',
    entityType: 'User',
    entityId: userId,
    after: { reason, role: user.role },
  })
  revalidatePath('/admin/users')
  return { ok: true, message: `${user.name} suspended.` }
}

export async function restoreUserAction(userId: string): Promise<UserActionResult> {
  const actor = await requirePermission('users:manage')

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  await db.user.update({
    where: { id: userId },
    data: { suspendedAt: null, suspensionReason: null },
  })
  await logAudit({
    actor,
    action: 'user.restored',
    entityType: 'User',
    entityId: userId,
  })
  revalidatePath('/admin/users')
  return { ok: true, message: `${user.name} restored.` }
}

/** Toggle a staff account's active flag — the older, blunter switch. */
export async function toggleUserActiveAction(userId: string): Promise<UserActionResult> {
  const actor = await requirePermission('users:manage')
  if (userId === actor.id) return { ok: false, error: 'You cannot deactivate yourself.' }

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  await db.user.update({ where: { id: userId }, data: { active: !user.active } })
  await logAudit({
    actor,
    action: user.active ? 'user.deactivated' : 'user.activated',
    entityType: 'User',
    entityId: userId,
  })
  revalidatePath('/admin/users')
  return { ok: true, message: user.active ? `${user.name} deactivated.` : `${user.name} reactivated.` }
}
