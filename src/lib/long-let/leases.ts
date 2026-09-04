/**
 * Leases.
 *
 * ADVANCE RENT — the local rule that shapes this whole module.
 *
 * Ghanaian tenancies are commonly paid a year or more up front. That money is
 * not revenue on the day it arrives; it is a liability that is earned month by
 * month. Treating it as income would tell an owner they had a spectacular
 * January and eleven empty months, and would overstate tax.
 *
 * The treatment here:
 *
 *   1. The tenant pays. That is a PAYMENT credit on their account and nothing
 *      more. Their balance goes deep into credit.
 *   2. The rent run raises ONE rent charge per month for the life of the
 *      lease, and each is settled automatically out of that credit.
 *   3. Owner statements recognise revenue from CHARGES RAISED, never from
 *      payments received.
 *
 * So the unearned balance is simply the tenant's unapplied credit, and it
 * unwinds correctly on its own. No parallel amortisation schedule to drift
 * out of step with the ledger.
 */

import type { BillingCycle, Currency, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { leaseCode } from '@/lib/core/ids'
import { addMonths, dateOnly, monthsPerCycle } from '@/lib/core/dates'
import { applyBasisPoints } from '@/lib/core/money'
import { unappliedCredit } from '@/lib/core/ledger'
import { normalisePhone } from '@/lib/core/phone'

export type CreateLeaseInput = {
  unitId: string
  tenant: {
    partyId?: string
    name: string
    phone?: string | null
    email?: string | null
    ghanaCard?: string | null
  }
  startDate: Date
  endDate: Date
  rentMinor: number
  currency?: Currency
  cycle?: BillingCycle
  dueDay?: number
  depositMinor?: number
  advanceMonths?: number
  escalationBasisPoints?: number
  graceDays?: number
  lateFeeBasisPoints?: number
  noticeDays?: number
  recurring?: Array<{
    label: string
    amountMinor: number
    type?: 'SERVICE_CHARGE' | 'UTILITY' | 'OTHER'
    cycle?: BillingCycle
  }>
  actorUserId?: string | null
}

export async function createLease(input: CreateLeaseInput) {
  return db.$transaction(async (tx) => {
    const unit = await tx.unit.findUniqueOrThrow({ where: { id: input.unitId } })

    if (unit.lettingMode === 'SHORT_STAY') {
      throw new Error(
        `${unit.name} is set to short stay only. Change its letting mode before creating a lease.`
      )
    }

    const overlapping = await tx.lease.findFirst({
      where: {
        unitId: input.unitId,
        status: 'ACTIVE',
        startDate: { lt: dateOnly(input.endDate) },
        endDate: { gt: dateOnly(input.startDate) },
      },
    })
    if (overlapping) {
      throw new Error(`${unit.name} already has an active lease covering those dates.`)
    }

    const tenantPartyId = await findOrCreateTenant(input.tenant, tx)

    const lease = await tx.lease.create({
      data: {
        code: leaseCode(),
        unitId: input.unitId,
        tenantPartyId,
        status: 'DRAFT',
        startDate: dateOnly(input.startDate),
        endDate: dateOnly(input.endDate),
        cycle: input.cycle ?? 'MONTHLY',
        currency: input.currency ?? 'GHS',
        rentMinor: input.rentMinor,
        dueDay: Math.min(Math.max(input.dueDay ?? 1, 1), 28),
        depositMinor: input.depositMinor ?? 0,
        advanceMonths: input.advanceMonths ?? 0,
        escalationBasisPoints: input.escalationBasisPoints ?? 0,
        graceDays: input.graceDays ?? 5,
        lateFeeBasisPoints: input.lateFeeBasisPoints ?? 0,
        noticeDays: input.noticeDays ?? 30,
      },
    })

    for (const item of input.recurring ?? []) {
      await tx.recurringCharge.create({
        data: {
          leaseId: lease.id,
          type: item.type ?? 'SERVICE_CHARGE',
          label: item.label,
          amountMinor: item.amountMinor,
          currency: lease.currency,
          cycle: item.cycle ?? 'MONTHLY',
          startDate: lease.startDate,
        },
      })
    }

    return lease
  })
}

async function findOrCreateTenant(
  tenant: CreateLeaseInput['tenant'],
  tx: Prisma.TransactionClient
): Promise<string> {
  if (tenant.partyId) {
    await tx.party.update({ where: { id: tenant.partyId }, data: { isTenant: true } })
    return tenant.partyId
  }

  const phone = normalisePhone(tenant.phone ?? '')
  const email = tenant.email?.toLowerCase().trim() || null

  if (phone || email) {
    const existing = await tx.party.findFirst({
      where: { OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])] },
    })
    if (existing) {
      await tx.party.update({ where: { id: existing.id }, data: { isTenant: true } })
      return existing.id
    }
  }

  const created = await tx.party.create({
    data: {
      type: 'PERSON',
      name: tenant.name,
      phone,
      email,
      ghanaCard: tenant.ghanaCard ?? null,
      isTenant: true,
    },
  })
  return created.id
}

/** Activating a lease is what makes it visible to the rent run. */
export async function activateLease(leaseId: string) {
  return db.$transaction(async (tx) => {
    const lease = await tx.lease.update({
      where: { id: leaseId },
      data: { status: 'ACTIVE', signedAt: new Date() },
    })
    await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'OCCUPIED' } })
    return lease
  })
}

export async function endLease(
  leaseId: string,
  args: { reason: string; endedAt?: Date; actorUserId?: string | null }
) {
  return db.$transaction(async (tx) => {
    const lease = await tx.lease.update({
      where: { id: leaseId },
      data: {
        status: 'ENDED',
        endedAt: args.endedAt ?? new Date(),
        endReason: args.reason,
      },
    })

    await tx.recurringCharge.updateMany({
      where: { leaseId },
      data: { active: false },
    })

    await tx.unit.update({ where: { id: lease.unitId }, data: { status: 'AVAILABLE' } })
    return lease
  })
}

/**
 * Rent for a given date, with annual escalation compounded on each anniversary.
 * A 10% escalation on a three-year lease means year three costs 21% more than
 * year one, not 30% — compounding, not addition.
 */
export function rentAtDate(
  lease: { startDate: Date; rentMinor: number; currency: Currency; escalationBasisPoints: number },
  onDate: Date
): number {
  if (lease.escalationBasisPoints === 0) return lease.rentMinor

  const start = dateOnly(lease.startDate)
  const target = dateOnly(onDate)
  let years = target.getUTCFullYear() - start.getUTCFullYear()
  const beforeAnniversary =
    target.getUTCMonth() < start.getUTCMonth() ||
    (target.getUTCMonth() === start.getUTCMonth() && target.getUTCDate() < start.getUTCDate())
  if (beforeAnniversary) years -= 1

  if (years <= 0) return lease.rentMinor

  let amount = { minor: lease.rentMinor, currency: lease.currency }
  for (let i = 0; i < years; i += 1) {
    const uplift = applyBasisPoints(amount, lease.escalationBasisPoints)
    amount = { minor: amount.minor + uplift.minor, currency: amount.currency }
  }
  return amount.minor
}

/**
 * What the tenant has paid for but not yet consumed. This is the advance-rent
 * liability, and it is derived rather than stored so it can never disagree
 * with the ledger.
 */
export async function unearnedRent(
  tenantPartyId: string,
  currency: Currency
): Promise<number> {
  return unappliedCredit(tenantPartyId, currency)
}

/** How many whole months of rent the credit on the account still covers. */
export async function monthsPaidAhead(leaseId: string): Promise<number> {
  const lease = await db.lease.findUniqueOrThrow({ where: { id: leaseId } })
  const credit = await unearnedRent(lease.tenantPartyId, lease.currency)
  if (lease.rentMinor <= 0) return 0
  return Math.floor(credit / lease.rentMinor)
}

/** Leases whose term ends within the window — the renewals worklist. */
export async function expiringLeases(withinDays = 90, propertyId?: string) {
  const horizon = addMonths(new Date(), 0)
  horizon.setUTCDate(horizon.getUTCDate() + withinDays)

  return db.lease.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lte: horizon },
      ...(propertyId ? { unit: { propertyId } } : {}),
    },
    include: {
      tenant: true,
      unit: { include: { property: { select: { name: true, id: true } } } },
    },
    orderBy: { endDate: 'asc' },
  })
}

export function cycleMonths(cycle: BillingCycle): number {
  return monthsPerCycle(cycle)
}
