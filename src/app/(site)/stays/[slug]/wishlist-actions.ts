'use server'

import { db } from '@/lib/db'
import { currentActor } from '@/lib/session'

/**
 * Toggle a unit on the signed-in guest's wishlist. Guests without an
 * account are told to sign in — the heart links there.
 */
export async function toggleWishlistAction(
  unitId: string
): Promise<{ saved: boolean; authRequired?: boolean }> {
  const actor = await currentActor()
  if (!actor) return { saved: false, authRequired: true }

  const existing = await db.wishlistItem.findUnique({
    where: { userId_unitId: { userId: actor.id, unitId } },
  })
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } })
    return { saved: false }
  }
  await db.wishlistItem.create({ data: { userId: actor.id, unitId } })
  return { saved: true }
}
