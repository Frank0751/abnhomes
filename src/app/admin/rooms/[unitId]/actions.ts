'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Put a room in someone's hands.
 *
 * Deliberately per-room rather than inherited from the building: ABN runs each
 * room independently, and a manager responsible for the penthouse is not
 * necessarily responsible for the studio.
 */
export async function assignManagerAction(
  unitId: string,
  managerId: string | null
): Promise<ActionResult> {
  try {
    const actor = await requireActor()
    const unit = await db.unit.findUniqueOrThrow({
      where: { id: unitId },
      select: { propertyId: true, name: true, managerId: true },
    })

    assertCanOnProperty(actor, 'units:write', unit.propertyId)

    let name: string | null = null
    if (managerId) {
      const manager = await db.user.findUnique({
        where: { id: managerId },
        select: { id: true, name: true, active: true },
      })
      if (!manager || !manager.active) {
        return { ok: false, error: 'That person is no longer an active member of staff.' }
      }
      name = manager.name
    }

    await db.unit.update({ where: { id: unitId }, data: { managerId } })

    await logAudit({
      actor,
      action: managerId ? 'room.manager_assigned' : 'room.manager_cleared',
      entityType: 'Unit',
      entityId: unitId,
      before: { managerId: unit.managerId },
      after: { managerId },
    })

    revalidatePath(`/admin/rooms/${unitId}`)
    revalidatePath('/admin/rooms')

    return {
      ok: true,
      message: name ? `${unit.name} is now managed by ${name}.` : `${unit.name} has no manager.`,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update the manager.',
    }
  }
}
