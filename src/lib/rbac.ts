/**
 * Roles and scoping.
 *
 * Two independent questions are answered here, and conflating them is how
 * property software leaks data:
 *
 *   1. WHAT may this role do?        -> permissions
 *   2. WHICH buildings may they do it to?  -> property scope
 *
 * A property manager has `money:record` everywhere in the abstract, but only
 * for the two buildings assigned to them. Both checks must pass. Scope is
 * enforced in the query layer, not in the interface, so it still holds on a
 * device that has been offline for a week.
 */

import type { Role } from '@prisma/client'

export type Permission =
  // Portfolio
  | 'units:read'
  | 'units:write'
  | 'parties:read'
  | 'parties:write'
  // Short stay
  | 'bookings:read'
  | 'bookings:write'
  | 'calendar:manage'
  | 'rates:write'
  // Long let
  | 'leases:read'
  | 'leases:write'
  | 'rentrun:execute'
  // Sales (Own-with-ABN) and public applications
  | 'sales:read'
  | 'sales:write'
  | 'applications:read'
  | 'applications:write'
  // Money
  | 'money:read'
  | 'money:record'
  | 'money:adjust'
  | 'money:reconcile'
  // Operations
  | 'maintenance:read'
  | 'maintenance:report'
  | 'maintenance:manage'
  | 'housekeeping:read'
  | 'housekeeping:complete'
  // Reporting and admin
  | 'reports:read'
  | 'owners:read'
  | 'owners:manage'
  | 'settings:write'
  | 'users:manage'
  | 'audit:read'
  // Marketplace
  | 'reviews:moderate'
  | 'promotions:manage'
  // Self-service portals
  | 'portal:owner'
  | 'portal:tenant'
  | 'portal:vendor'

const ALL: Permission[] = [
  'units:read', 'units:write', 'parties:read', 'parties:write',
  'bookings:read', 'bookings:write', 'calendar:manage', 'rates:write',
  'leases:read', 'leases:write', 'rentrun:execute',
  'sales:read', 'sales:write', 'applications:read', 'applications:write',
  'money:read', 'money:record', 'money:adjust', 'money:reconcile',
  'maintenance:read', 'maintenance:report', 'maintenance:manage',
  'housekeeping:read', 'housekeeping:complete',
  'reports:read', 'owners:read', 'owners:manage',
  'settings:write', 'users:manage', 'audit:read',
  'reviews:moderate', 'promotions:manage',
  'portal:owner', 'portal:tenant', 'portal:vendor',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,

  PROPERTY_MANAGER: [
    'units:read', 'units:write', 'parties:read', 'parties:write',
    'bookings:read', 'bookings:write', 'calendar:manage', 'rates:write',
    'leases:read', 'leases:write',
    'sales:read', 'sales:write', 'applications:read', 'applications:write',
    'money:read', 'money:record',
    'maintenance:read', 'maintenance:report', 'maintenance:manage',
    'housekeeping:read', 'housekeeping:complete',
    'reports:read', 'owners:read',
    'reviews:moderate', 'promotions:manage',
  ],

  // Takes bookings and money at the desk; cannot alter what is owed.
  FRONT_DESK: [
    'units:read', 'parties:read', 'parties:write',
    'bookings:read', 'bookings:write', 'calendar:manage',
    'sales:read', 'applications:read', 'applications:write',
    'money:read', 'money:record',
    'maintenance:report',
    'housekeeping:read',
    'reviews:moderate',
  ],

  // Sees money everywhere. Deliberately cannot change leases or bookings.
  FINANCE: [
    'units:read', 'parties:read',
    'bookings:read', 'leases:read', 'rentrun:execute',
    'sales:read', 'applications:read',
    'money:read', 'money:record', 'money:adjust', 'money:reconcile',
    'maintenance:read',
    'reports:read', 'owners:read', 'owners:manage',
    'audit:read',
  ],

  HOUSEKEEPING: [
    'units:read',
    'bookings:read',
    'housekeeping:read', 'housekeeping:complete',
    'maintenance:report',
  ],

  VENDOR: ['maintenance:read', 'portal:vendor'],

  OWNER: ['portal:owner', 'owners:read'],

  TENANT: ['portal:tenant'],
}

/** Roles whose reach is the whole portfolio, by policy. */
const UNSCOPED_ROLES: Role[] = ['SUPER_ADMIN', 'FINANCE']

export type Actor = {
  id: string
  role: Role
  /** Buildings explicitly assigned. Ignored for unscoped roles. */
  propertyIds: string[]
  partyId?: string | null
}

export function can(actor: Pick<Actor, 'role'>, permission: Permission): boolean {
  return ROLE_PERMISSIONS[actor.role].includes(permission)
}

export function canAll(actor: Pick<Actor, 'role'>, permissions: Permission[]): boolean {
  return permissions.every((p) => can(actor, p))
}

export function canAny(actor: Pick<Actor, 'role'>, permissions: Permission[]): boolean {
  return permissions.some((p) => can(actor, p))
}

export function isUnscoped(role: Role): boolean {
  return UNSCOPED_ROLES.includes(role)
}

/**
 * The property filter to apply to every query.
 * `null` means no filter (portfolio-wide). An empty array means no access at
 * all, which must still produce an empty result rather than everything.
 */
export function propertyScope(actor: Actor): string[] | null {
  if (isUnscoped(actor.role)) return null
  return actor.propertyIds
}

/** Spread straight into a Prisma `where` on any model with a propertyId. */
export function propertyWhere(actor: Actor): { propertyId?: { in: string[] } } {
  const scope = propertyScope(actor)
  return scope === null ? {} : { propertyId: { in: scope } }
}

/**
 * The same filter for models that reach a property through a unit —
 * reservations, housekeeping tasks, calendar blocks.
 */
export function unitScopeWhere(actor: Actor): { unit?: { propertyId: { in: string[] } } } {
  const scope = propertyScope(actor)
  return scope === null ? {} : { unit: { propertyId: { in: scope } } }
}

export function hasPropertyAccess(actor: Actor, propertyId: string): boolean {
  if (isUnscoped(actor.role)) return true
  return actor.propertyIds.includes(propertyId)
}

export class AccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccessError'
  }
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw new AccessError(`Role ${actor.role} is not permitted to ${permission}.`)
  }
}

export function assertPropertyAccess(actor: Actor, propertyId: string): void {
  if (!hasPropertyAccess(actor, propertyId)) {
    throw new AccessError('You do not have access to this property.')
  }
}

/** Both checks together — the normal call at the top of a mutation. */
export function assertCanOnProperty(
  actor: Actor,
  permission: Permission,
  propertyId: string
): void {
  assertCan(actor, permission)
  assertPropertyAccess(actor, propertyId)
}

export const STAFF_ROLES: Role[] = [
  'SUPER_ADMIN', 'PROPERTY_MANAGER', 'FRONT_DESK', 'FINANCE', 'HOUSEKEEPING',
]

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role)
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Administrator',
  PROPERTY_MANAGER: 'Property manager',
  FRONT_DESK: 'Front desk',
  FINANCE: 'Finance',
  HOUSEKEEPING: 'Housekeeping',
  VENDOR: 'Vendor',
  OWNER: 'Owner',
  TENANT: 'Tenant',
}

/** Where each role lands after signing in. */
export function homeRouteFor(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'PROPERTY_MANAGER':
    case 'FINANCE':
      return '/admin'
    case 'FRONT_DESK':
      return '/admin/calendar'
    case 'HOUSEKEEPING':
      return '/admin/housekeeping'
    case 'OWNER':
      return '/portal/owner'
    case 'VENDOR':
      return '/portal/vendor'
    case 'TENANT':
      return '/portal/tenant'
  }
}
