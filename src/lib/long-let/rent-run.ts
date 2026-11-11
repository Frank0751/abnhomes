/**
 * The rent run.
 *
 * A scheduled job that raises every rent and service charge that has fallen
 * due, then sweeps any credit on the tenant's account against them. It is the
 * single most consequential piece of automation in the system, so it is built
 * to two rules:
 *
 *   IDEMPOTENT. Every charge carries a runKey of the form
 *   `rent:<leaseId>:<YYYY-MM>`. Running the job twice — by cron, by hand, by
 *   a retry after a timeout — cannot bill a tenant twice.
 *
 *   REHEARSABLE. `dryRun` computes exactly what would be charged and writes
 *   nothing. Nobody should ever discover what the rent run does by running it
 *   against real tenants.
 */

import type { Currency } from '@prisma/client'
import { db, TX_OPTS } from '@/lib/db'
import { postCharge } from '@/lib/core/ledger'
import {
  addMonths,
  dateOnly,
  daysOverdue,
  dueDateInMonth,
  formatDate,
  monthsPerCycle,
} from '@/lib/core/dates'
import { applyBasisPoints, formatMinor } from '@/lib/core/money'
import { rentAtDate } from './leases'
import { sendSms, templates } from '@/lib/messaging'

export type RentRunLine = {
  leaseId: string
  leaseCode: string
  unitName: string
  tenantName: string
  tenantPartyId: string
  description: string
  amountMinor: number
  currency: Currency
  dueDate: Date
  runKey: string
  alreadyBilled: boolean
}

export type RentRunResult = {
  asOf: Date
  dryRun: boolean
  lines: RentRunLine[]
  chargedCount: number
  skippedCount: number
  totalByCurrency: Array<{ currency: Currency; minor: number }>
}

/**
 * Raise everything due on or before `asOf`.
 *
 * Charges are raised for periods that have STARTED, not for the whole term at
 * once. A three-year lease does not put three years of debt on a tenant's
 * account on day one — that would make every arrears report meaningless.
 */
export async function runRentCycle(
  options: {
    asOf?: Date
    propertyId?: string
    leaseId?: string
    dryRun?: boolean
    actorUserId?: string | null
  } = {}
): Promise<RentRunResult> {
  const asOf = dateOnly(options.asOf ?? new Date())
  const dryRun = options.dryRun ?? false

  const leases = await db.lease.findMany({
    where: {
      status: 'ACTIVE',
      startDate: { lte: asOf },
      ...(options.leaseId ? { id: options.leaseId } : {}),
      ...(options.propertyId ? { unit: { propertyId: options.propertyId } } : {}),
    },
    include: {
      tenant: true,
      unit: { include: { property: { select: { id: true, name: true } } } },
      recurringCharges: { where: { active: true } },
    },
  })

  const lines: RentRunLine[] = []

  for (const lease of leases) {
    const step = monthsPerCycle(lease.cycle)
    let periodStart = dateOnly(lease.startDate)

    // Walk the lease term one billing cycle at a time.
    while (periodStart <= asOf && periodStart < dateOnly(lease.endDate)) {
      const periodEnd = addMonths(periodStart, step)
      const dueDate = dueDateInMonth(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth(),
        lease.dueDay
      )

      if (dueDate > asOf) break

      const periodLabel = `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`
      const rentMinor = rentAtDate(lease, periodStart) * step

      lines.push({
        leaseId: lease.id,
        leaseCode: lease.code,
        unitName: lease.unit.name,
        tenantName: lease.tenant.name,
        tenantPartyId: lease.tenantPartyId,
        description: `Rent for ${formatDate(periodStart)} to ${formatDate(periodEnd)} — ${lease.unit.name}`,
        amountMinor: rentMinor,
        currency: lease.currency,
        dueDate,
        runKey: `rent:${lease.id}:${periodLabel}`,
        alreadyBilled: false,
      })

      for (const recurring of lease.recurringCharges) {
        if (dateOnly(recurring.startDate) > periodStart) continue
        if (recurring.endDate && dateOnly(recurring.endDate) <= periodStart) continue

        lines.push({
          leaseId: lease.id,
          leaseCode: lease.code,
          unitName: lease.unit.name,
          tenantName: lease.tenant.name,
          tenantPartyId: lease.tenantPartyId,
          description: `${recurring.label} — ${formatDate(periodStart)} to ${formatDate(periodEnd)}`,
          amountMinor: recurring.amountMinor * monthsPerCycle(recurring.cycle),
          currency: recurring.currency,
          dueDate,
          runKey: `${recurring.id}:${periodLabel}`,
          alreadyBilled: false,
        })
      }

      periodStart = periodEnd
    }
  }

  // Which of these have already been raised by an earlier run.
  const existing = await db.charge.findMany({
    where: { runKey: { in: lines.map((l) => l.runKey) } },
    select: { runKey: true },
  })
  const billed = new Set(existing.map((c) => c.runKey))
  for (const line of lines) {
    line.alreadyBilled = billed.has(line.runKey)
  }

  const pending = lines.filter((l) => !l.alreadyBilled)

  if (!dryRun) {
    const leaseById = new Map(leases.map((l) => [l.id, l]))

    for (const line of pending) {
      const lease = leaseById.get(line.leaseId)
      if (!lease) continue

      await postCharge({
        propertyId: lease.unit.propertyId,
        partyId: line.tenantPartyId,
        unitId: lease.unitId,
        type: line.runKey.startsWith('rent:') ? 'RENT' : 'SERVICE_CHARGE',
        description: line.description,
        amountMinor: line.amountMinor,
        currency: line.currency,
        dueDate: line.dueDate,
        leaseId: lease.id,
        runKey: line.runKey,
        actorUserId: options.actorUserId,
      })
    }

    // Sweep advance rent and any other credit onto the charges just raised.
    const touchedTenants = new Set(pending.map((l) => `${l.tenantPartyId}:${l.currency}`))
    for (const key of touchedTenants) {
      const [partyId, currency] = key.split(':')
      await applyCreditsToOpenCharges(partyId, currency as Currency)
    }
  }

  const totals = new Map<Currency, number>()
  for (const line of pending) {
    totals.set(line.currency, (totals.get(line.currency) ?? 0) + line.amountMinor)
  }

  return {
    asOf,
    dryRun,
    lines,
    chargedCount: pending.length,
    skippedCount: lines.length - pending.length,
    totalByCurrency: [...totals.entries()].map(([currency, minor]) => ({ currency, minor })),
  }
}

/**
 * Allocate money already on account to open charges, oldest first.
 *
 * This is what makes advance rent work. A tenant who paid two years up front
 * has a large unapplied credit; each month's rent charge is settled from it
 * automatically, so the tenant is never shown as in arrears and the owner is
 * only credited with the month actually earned.
 */
export async function applyCreditsToOpenCharges(
  partyId: string,
  currency: Currency
): Promise<{ allocatedMinor: number; chargesSettled: number }> {
  return db.$transaction(async (tx) => {
    const payments = await tx.payment.findMany({
      where: { partyId, currency, status: 'CONFIRMED' },
      include: { allocations: true },
      orderBy: { receivedAt: 'asc' },
    })

    const withCredit = payments
      .map((p) => ({
        id: p.id,
        remaining: p.amountMinor - p.allocations.reduce((s, a) => s + a.amountMinor, 0),
      }))
      .filter((p) => p.remaining > 0)

    if (withCredit.length === 0) return { allocatedMinor: 0, chargesSettled: 0 }

    const openCharges = await tx.charge.findMany({
      where: { partyId, currency, status: { in: ['OPEN', 'PART_PAID'] } },
      include: { allocations: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    })

    let allocatedMinor = 0
    let chargesSettled = 0

    for (const charge of openCharges) {
      let outstanding =
        charge.amountMinor - charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
      if (outstanding <= 0) continue

      for (const credit of withCredit) {
        if (outstanding <= 0 || credit.remaining <= 0) continue

        const amount = Math.min(outstanding, credit.remaining)

        // A payment may already touch this charge from an earlier sweep.
        const existing = await tx.allocation.findUnique({
          where: { paymentId_chargeId: { paymentId: credit.id, chargeId: charge.id } },
        })

        if (existing) {
          await tx.allocation.update({
            where: { id: existing.id },
            data: { amountMinor: existing.amountMinor + amount },
          })
        } else {
          await tx.allocation.create({
            data: { paymentId: credit.id, chargeId: charge.id, amountMinor: amount },
          })
        }

        credit.remaining -= amount
        outstanding -= amount
        allocatedMinor += amount
      }

      await tx.charge.update({
        where: { id: charge.id },
        data: { status: outstanding <= 0 ? 'SETTLED' : 'PART_PAID' },
      })
      if (outstanding <= 0) chargesSettled += 1
    }

    return { allocatedMinor, chargesSettled }
  }, TX_OPTS)
}

/**
 * Late fees on charges still unpaid after their grace period.
 * Idempotent per charge, so a charge is only ever fined once.
 */
export async function applyLateFees(
  options: { asOf?: Date; propertyId?: string; dryRun?: boolean; actorUserId?: string | null } = {}
): Promise<{ applied: number; totalMinor: number; currency: Currency | null }> {
  const asOf = dateOnly(options.asOf ?? new Date())

  const overdue = await db.charge.findMany({
    where: {
      status: { in: ['OPEN', 'PART_PAID'] },
      type: { in: ['RENT', 'SERVICE_CHARGE'] },
      dueDate: { lt: asOf },
      ...(options.propertyId ? { propertyId: options.propertyId } : {}),
    },
    include: {
      lease: true,
      allocations: true,
      party: { select: { name: true } },
    },
  })

  let applied = 0
  let totalMinor = 0
  let currency: Currency | null = null

  for (const charge of overdue) {
    const lease = charge.lease
    if (!lease || lease.lateFeeBasisPoints <= 0) continue
    if (daysOverdue(charge.dueDate, asOf) <= lease.graceDays) continue

    const outstanding =
      charge.amountMinor - charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
    if (outstanding <= 0) continue

    const fee = applyBasisPoints(
      { minor: outstanding, currency: charge.currency },
      lease.lateFeeBasisPoints
    )
    if (fee.minor <= 0) continue

    totalMinor += fee.minor
    currency = charge.currency
    applied += 1

    if (!options.dryRun) {
      await postCharge({
        propertyId: charge.propertyId,
        partyId: charge.partyId,
        unitId: charge.unitId,
        type: 'LATE_FEE',
        description: `Late payment fee on ${charge.description}`,
        amountMinor: fee.minor,
        currency: charge.currency,
        dueDate: asOf,
        leaseId: lease.id,
        runKey: `late:${charge.id}`,
        actorUserId: options.actorUserId,
      })
    }
  }

  return { applied, totalMinor, currency }
}

/**
 * Rent reminders: a nudge before the due date, then escalating notices after.
 * Deliberately quiet — one message per tenant per run, not one per charge.
 */
export async function sendRentReminders(
  options: { asOf?: Date; propertyId?: string; dryRun?: boolean } = {}
): Promise<{ sent: number; skipped: number }> {
  const asOf = dateOnly(options.asOf ?? new Date())

  const charges = await db.charge.findMany({
    where: {
      status: { in: ['OPEN', 'PART_PAID'] },
      type: { in: ['RENT', 'SERVICE_CHARGE', 'LATE_FEE'] },
      ...(options.propertyId ? { propertyId: options.propertyId } : {}),
    },
    include: { party: true, allocations: true },
    orderBy: { dueDate: 'asc' },
  })

  const byTenant = new Map<
    string,
    { name: string; phone: string | null; outstanding: number; currency: Currency; oldestDue: Date }
  >()

  for (const charge of charges) {
    const outstanding =
      charge.amountMinor - charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
    if (outstanding <= 0) continue

    const existing = byTenant.get(charge.partyId)
    if (existing) {
      existing.outstanding += outstanding
      if (charge.dueDate < existing.oldestDue) existing.oldestDue = charge.dueDate
    } else {
      byTenant.set(charge.partyId, {
        name: charge.party.name,
        phone: charge.party.phone,
        outstanding,
        currency: charge.currency,
        oldestDue: charge.dueDate,
      })
    }
  }

  let sent = 0
  let skipped = 0

  for (const tenant of byTenant.values()) {
    if (!tenant.phone) {
      skipped += 1
      continue
    }

    const overdueDays = daysOverdue(tenant.oldestDue, asOf)
    const firstName = tenant.name.split(' ')[0]
    const amount = formatMinor(tenant.outstanding, tenant.currency)

    const body =
      overdueDays > 0
        ? templates.rentOverdue(firstName, amount, overdueDays)
        : templates.rentDue(firstName, amount, formatDate(tenant.oldestDue))

    if (!options.dryRun) {
      await sendSms({ to: tenant.phone, body, template: overdueDays > 0 ? 'rent_overdue' : 'rent_due' })
    }
    sent += 1
  }

  return { sent, skipped }
}
