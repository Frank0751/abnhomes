/**
 * Maintenance.
 *
 * A ticket is where operations and money meet: the plumber's invoice has to
 * reach the owner's statement, and if the damage was the tenant's it has to
 * reach the tenant's account instead. Resolving a ticket with a cost posts the
 * expense in the same transaction, so no repair is ever paid for twice or
 * quietly absorbed.
 */

import type { Currency, TicketCategory, TicketPriority } from '@prisma/client'
import { db } from '@/lib/db'
import { ticketCode } from '@/lib/core/ids'
import { postCharge, postExpense } from '@/lib/core/ledger'
import { propertyWhere, type Actor } from '@/lib/rbac'
import { sendSms, templates } from '@/lib/messaging'

/** Response targets, in hours. An emergency is same-day by definition. */
const SLA_HOURS: Record<TicketPriority, number> = {
  EMERGENCY: 4,
  HIGH: 24,
  NORMAL: 72,
  LOW: 168,
}

export function slaDueAt(priority: TicketPriority, from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 3_600_000)
}

export type CreateTicketInput = {
  propertyId: string
  unitId?: string | null
  title: string
  description: string
  category?: TicketCategory
  priority?: TicketPriority
  reporterPartyId?: string | null
  photos?: string[]
  actorUserId?: string | null
  idempotencyKey?: string | null
}

export async function createTicket(input: CreateTicketInput) {
  if (input.idempotencyKey) {
    const existing = await db.ticket.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    })
    if (existing) return existing
  }

  const priority = input.priority ?? 'NORMAL'

  const ticket = await db.ticket.create({
    data: {
      code: ticketCode(),
      propertyId: input.propertyId,
      unitId: input.unitId ?? null,
      title: input.title,
      description: input.description,
      category: input.category ?? 'OTHER',
      priority,
      status: 'OPEN',
      reporterPartyId: input.reporterPartyId ?? null,
      photos: input.photos ?? [],
      slaDueAt: slaDueAt(priority),
      idempotencyKey: input.idempotencyKey ?? null,
    },
    include: { reporter: true },
  })

  if (ticket.reporter?.phone) {
    await sendSms({
      to: ticket.reporter.phone,
      body: templates.ticketLogged(ticket.code, ticket.title),
      template: 'ticket_logged',
      entityType: 'Ticket',
      entityId: ticket.id,
    })
  }

  return ticket
}

export async function assignTicket(
  ticketId: string,
  args: { assigneeUserId?: string | null; vendorPartyId?: string | null }
) {
  return db.ticket.update({
    where: { id: ticketId },
    data: {
      assigneeUserId: args.assigneeUserId ?? null,
      vendorPartyId: args.vendorPartyId ?? null,
      status: 'ASSIGNED',
    },
  })
}

/**
 * Close a ticket and book what it cost.
 *
 * `rechargeToTenant` decides where the money lands: a charge on the tenant's
 * account for damage they caused, or an expense against the property that the
 * owner ultimately carries. Getting this wrong is how a landlord ends up
 * paying for a tenant's broken window, so it is an explicit decision, never
 * a default.
 */
export async function resolveTicket(
  ticketId: string,
  args: {
    resolution: string
    costMinor?: number
    currency?: Currency
    rechargeToTenant?: boolean
    actorUserId?: string | null
  }
) {
  return db.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { reporter: true, unit: true },
    })

    const cost = args.costMinor ?? 0
    const currency = args.currency ?? 'GHS'

    if (cost > 0) {
      if (args.rechargeToTenant) {
        const lease = await tx.lease.findFirst({
          where: { unitId: ticket.unitId ?? '', status: 'ACTIVE' },
        })
        const partyId = lease?.tenantPartyId ?? ticket.reporterPartyId

        if (!partyId) {
          throw new Error(
            'Cannot recharge this cost: no active lease or reporter to charge it to.'
          )
        }

        await postCharge(
          {
            propertyId: ticket.propertyId,
            partyId,
            unitId: ticket.unitId,
            type: 'MAINTENANCE_RECHARGE',
            description: `Maintenance recharge — ${ticket.title} (${ticket.code})`,
            amountMinor: cost,
            currency,
            dueDate: new Date(),
            runKey: `ticket:${ticket.id}`,
            actorUserId: args.actorUserId,
          },
          tx
        )
      } else {
        await postExpense(
          {
            propertyId: ticket.propertyId,
            unitId: ticket.unitId,
            partyId: ticket.vendorPartyId,
            amountMinor: cost,
            currency,
            description: `Maintenance — ${ticket.title} (${ticket.code})`,
            ticketId: ticket.id,
            actorUserId: args.actorUserId,
          },
          tx
        )
      }
    }

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolution: args.resolution,
        resolvedAt: new Date(),
        costMinor: cost > 0 ? cost : null,
        currency,
        rechargeToTenant: args.rechargeToTenant ?? false,
      },
    })

    return updated
  })
}

export async function addTicketComment(
  ticketId: string,
  args: { authorUserId?: string | null; authorName: string; body: string; internal?: boolean; photos?: string[] }
) {
  return db.ticketComment.create({
    data: {
      ticketId,
      authorUserId: args.authorUserId ?? null,
      authorName: args.authorName,
      body: args.body,
      internal: args.internal ?? false,
      photos: args.photos ?? [],
    },
  })
}

export async function closeTicket(ticketId: string) {
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { status: 'CLOSED', closedAt: new Date() },
    include: { reporter: true },
  })

  if (ticket.reporter?.phone) {
    await sendSms({
      to: ticket.reporter.phone,
      body: templates.ticketResolved(ticket.code),
      template: 'ticket_resolved',
      entityType: 'Ticket',
      entityId: ticket.id,
    })
  }

  return ticket
}

/** The maintenance board, scoped to what the actor may see. */
export async function ticketQueue(
  actor: Actor,
  options: { status?: 'open' | 'all'; propertyId?: string } = {}
) {
  return db.ticket.findMany({
    where: {
      ...(options.status === 'all'
        ? {}
        : { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] } }),
      ...(options.propertyId ? { propertyId: options.propertyId } : propertyWhere(actor)),
    },
    include: {
      property: { select: { name: true } },
      unit: { select: { name: true, code: true } },
      assignee: { select: { name: true } },
      vendor: { select: { name: true } },
      reporter: { select: { name: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })
}

/** Tickets past their response target. The escalation list. */
export async function breachedTickets(actor: Actor) {
  return db.ticket.findMany({
    where: {
      status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      slaDueAt: { lt: new Date() },
      ...propertyWhere(actor),
    },
    include: {
      property: { select: { name: true } },
      unit: { select: { name: true } },
    },
    orderBy: { slaDueAt: 'asc' },
  })
}
