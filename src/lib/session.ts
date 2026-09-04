/**
 * The bridge between an authenticated session and the access-control layer.
 *
 * Every server action and route handler starts here. Getting the Actor is the
 * only sanctioned way to learn who is asking, and `requirePermission` is the
 * only sanctioned way to decide whether they may.
 */

import { auth } from '@/lib/auth'
import { AccessError, type Actor, type Permission, assertCan, assertPropertyAccess } from '@/lib/rbac'

export async function currentActor(): Promise<Actor | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  return {
    id: session.user.id,
    role: session.user.role,
    partyId: session.user.partyId ?? null,
    propertyIds: session.user.propertyIds ?? [],
  }
}

export async function requireActor(): Promise<Actor> {
  const actor = await currentActor()
  if (!actor) throw new AccessError('You must be signed in.')
  return actor
}

/** Assert a capability and hand back the actor in one step. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor()
  assertCan(actor, permission)
  return actor
}

/** Assert a capability against one specific building. */
export async function requirePermissionOn(
  permission: Permission,
  propertyId: string
): Promise<Actor> {
  const actor = await requirePermission(permission)
  assertPropertyAccess(actor, propertyId)
  return actor
}

/** For portal routes: the party record behind the signed-in user. */
export async function requireParty(): Promise<{ actor: Actor; partyId: string }> {
  const actor = await requireActor()
  if (!actor.partyId) {
    throw new AccessError('This account is not linked to a customer record.')
  }
  return { actor, partyId: actor.partyId }
}
