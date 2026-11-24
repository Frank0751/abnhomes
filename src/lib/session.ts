/**
 * The bridge between an authenticated session and the access-control layer.
 *
 * Every server action and route handler starts here. Getting the Actor is the
 * only sanctioned way to learn who is asking, and `requirePermission` is the
 * only sanctioned way to decide whether they may.
 */

import { cache } from 'react'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AccessError, type Actor, type Permission, assertCan, assertPropertyAccess } from '@/lib/rbac'

/**
 * Cached for the length of one request. The layout, the page and any helper
 * they call all ask who is signed in; they now share one answer instead of
 * decoding the session again each time.
 */
export const currentActor = cache(async function currentActor(): Promise<Actor | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  return {
    id: session.user.id,
    role: session.user.role,
    partyId: session.user.partyId ?? null,
    propertyIds: session.user.propertyIds ?? [],
  }
})

/**
 * The account behind a session, read fresh from the database once per
 * request. The admin layout and every permission check on the page used to
 * make this same lookup separately, so each admin page paid for it two or
 * three times before doing any work of its own.
 */
export const loadAccount = cache(async function loadAccount(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      active: true,
      suspendedAt: true,
      role: true,
      partyId: true,
      propertyAccess: { select: { propertyId: true } },
    },
  })
})

/**
 * The actor behind a MUTATION, with the account confirmed still active.
 *
 * The session is a JWT and is never revalidated after sign-in, so deactivating
 * someone does not invalidate the cookie they already hold. Redirecting them
 * at the layout is not enough: a server action is a POST to the route, and its
 * body runs before any layout re-render — so a dismissed clerk could still
 * record payments, refund them, or reassign rooms, with the audit trail
 * recording their name as if nothing were wrong.
 *
 * This costs one indexed lookup per action, which is the right trade for
 * "a sacked employee cannot touch the money".
 *
 * The role and buildings come from the same lookup rather than the token, so
 * an administrator who changes someone's role or takes a building away
 * changes what they can do on their very next click, not whenever their
 * 30-day session happens to end.
 */
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor()
  if (!actor) throw new AccessError('You must be signed in.')

  const account = await loadAccount(actor.id)
  if (!account || !account.active || account.suspendedAt) {
    throw new AccessError('This account is no longer active. Please sign in again.')
  }

  return {
    id: actor.id,
    role: account.role,
    partyId: account.partyId,
    propertyIds: account.propertyAccess.map((a) => a.propertyId),
  }
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
