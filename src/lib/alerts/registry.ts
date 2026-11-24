/**
 * Every event the business is told about, declared once.
 *
 * Before this, telling someone something meant adding a notifyStaff() call
 * wherever the thing happened — which is why only two of fifteen events ever
 * reached anybody. A registry inverts that: the event is declared here with
 * its urgency and its audience, and the code that raises it says only what
 * happened. Adding an event is one entry; changing who hears about payments
 * is one line, not a search through the codebase.
 *
 * URGENCY is the pacing decision, and it is deliberate:
 *
 *   INSTANT  money and bookings — a payment, a booking, a cancellation, an
 *            emergency repair. These interrupt. They are also the ones where
 *            an hour's delay costs something real.
 *   DIGEST   everything else, gathered into one message each morning. Not
 *            less important, just not worth a phone buzzing at midnight.
 *
 * Everything lands in the in-app bell either way; urgency only decides
 * whether it also leaves the building immediately.
 */

import type { Role } from '@prisma/client'

export type AlertUrgency = 'INSTANT' | 'DIGEST'

export type AlertDefinition = {
  urgency: AlertUrgency
  /** Groups the bell and the digest: booking | payment | task | system | review */
  category: string
  /** Who sees it in the admin console, over and above anyone set to hear everything. */
  roles: Role[]
  /** Heading this event sits under in the morning digest. */
  digestGroup: string
}

const DESK: Role[] = ['SUPER_ADMIN', 'PROPERTY_MANAGER', 'FRONT_DESK']
const MONEY: Role[] = ['SUPER_ADMIN', 'PROPERTY_MANAGER', 'FINANCE']
const MONEY_AND_DESK: Role[] = ['SUPER_ADMIN', 'PROPERTY_MANAGER', 'FINANCE', 'FRONT_DESK']
const UPKEEP: Role[] = ['SUPER_ADMIN', 'PROPERTY_MANAGER', 'HOUSEKEEPING']

export const ALERTS = {
  // ------------------------------------------------------------- bookings
  'booking.requested': {
    urgency: 'INSTANT', category: 'booking', roles: DESK,
    digestGroup: 'Bookings',
  },
  'booking.confirmed': {
    urgency: 'INSTANT', category: 'booking', roles: DESK,
    digestGroup: 'Bookings',
  },
  'booking.cancelled': {
    urgency: 'INSTANT', category: 'booking', roles: MONEY_AND_DESK,
    digestGroup: 'Bookings',
  },
  /** A guest moved their own dates, or asked for a move that needs the office. */
  'booking.changed': {
    urgency: 'INSTANT', category: 'booking', roles: MONEY_AND_DESK,
    digestGroup: 'Bookings',
  },
  /** Airbnb or Booking.com shows a guest on nights ABN has already sold. */
  'calendar.conflict': {
    urgency: 'INSTANT', category: 'booking', roles: DESK,
    digestGroup: 'Bookings',
  },
  /** A booking-site calendar could not be read; its dates may be out of date. */
  'calendar.feed_failed': {
    urgency: 'DIGEST', category: 'system', roles: DESK,
    digestGroup: 'Changes',
  },

  // ---------------------------------------------------------------- money
  'payment.received': {
    urgency: 'INSTANT', category: 'payment', roles: MONEY_AND_DESK,
    digestGroup: 'Money in',
  },
  'payment.failed': {
    urgency: 'INSTANT', category: 'payment', roles: MONEY,
    digestGroup: 'Money in',
  },
  'receipt.issued': {
    urgency: 'INSTANT', category: 'payment', roles: MONEY,
    digestGroup: 'Money in',
  },
  'refund.processed': {
    urgency: 'INSTANT', category: 'payment', roles: MONEY,
    digestGroup: 'Money out',
  },

  // ------------------------------------------------------------ emergency
  // A burst pipe at 2am is not a digest item.
  'maintenance.urgent': {
    urgency: 'INSTANT', category: 'task', roles: UPKEEP,
    digestGroup: 'Maintenance',
  },

  // ----------------------------------------------------------- the morning
  'maintenance.raised': {
    urgency: 'DIGEST', category: 'task', roles: UPKEEP,
    digestGroup: 'Maintenance',
  },
  'lease.created': {
    urgency: 'DIGEST', category: 'booking', roles: MONEY_AND_DESK,
    digestGroup: 'Tenancies',
  },
  'lease.ending': {
    urgency: 'DIGEST', category: 'booking', roles: MONEY_AND_DESK,
    digestGroup: 'Tenancies',
  },
  'arrears.flagged': {
    urgency: 'DIGEST', category: 'payment', roles: MONEY,
    digestGroup: 'Arrears',
  },
  'application.submitted': {
    urgency: 'DIGEST', category: 'booking', roles: DESK,
    digestGroup: 'Tenancies',
  },
  'review.received': {
    urgency: 'DIGEST', category: 'review', roles: DESK,
    digestGroup: 'Reviews',
  },
  'rates.changed': {
    urgency: 'DIGEST', category: 'system', roles: MONEY,
    digestGroup: 'Changes',
  },
} as const satisfies Record<string, AlertDefinition>

export type AlertEvent = keyof typeof ALERTS

/** The order groups appear in the digest — most consequential first. */
export const DIGEST_ORDER = [
  'Money in',
  'Money out',
  'Bookings',
  'Arrears',
  'Tenancies',
  'Maintenance',
  'Reviews',
  'Changes',
] as const

export function definitionFor(event: AlertEvent): AlertDefinition {
  return ALERTS[event]
}
