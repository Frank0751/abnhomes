/**
 * Tenancy applications — how a member of the public becomes a tenant.
 *
 * The public /rent journey ends here. Staff screen the application, and on
 * approval it is converted into a Lease through the same createLease() engine
 * the manual admin flow uses, so arrears, rent runs and statements treat a
 * converted tenant exactly like any other. The applicant follows the whole
 * thing with their RNT-… code, no account required.
 */

import { db, TX_OPTS } from '@/lib/db'
import type { Actor } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { queueMessage } from '@/lib/notify'
import { tenancyApplicationCode, leaseCode } from '@/lib/core/ids'
import { phoneVariants, normalisePhone } from '@/lib/core/phone'
import { createLease, activateLease } from '@/lib/long-let/leases'
import { Prisma } from '@prisma/client'

export type CreateTenancyApplicationInput = {
  unitId: string
  applicantName: string
  applicantPhone: string
  applicantEmail?: string | null
  ghanaCard?: string | null
  employer?: string | null
  moveInDate: Date
  leaseMonths: number
  notes?: string | null
}

async function findOrCreateApplicant(
  name: string,
  phone: string,
  email: string | null,
  tx: Prisma.TransactionClient
) {
  const variants = phoneVariants(phone)
  const existing = await tx.party.findFirst({
    where: { OR: variants.map((p) => ({ phone: p })) },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) {
    return tx.party.update({
      where: { id: existing.id },
      data: { name: existing.name || name, email: existing.email ?? email, isTenant: true },
    })
  }
  return tx.party.create({
    data: {
      type: 'PERSON',
      name,
      phone: normalisePhone(phone) ?? phone,
      email,
      isTenant: true,
    },
  })
}

export async function createTenancyApplication(input: CreateTenancyApplicationInput) {
  const run = async (tx: Prisma.TransactionClient) => {
    // A long-let application needs a published, rentable unit with no active lease.
    const unit = await tx.unit.findFirst({
      where: {
        id: input.unitId,
        published: true,
        lettingMode: { in: ['LONG_LET', 'BOTH'] },
        status: { in: ['AVAILABLE'] },
        leases: { none: { status: 'ACTIVE' } },
      },
      include: {
        property: { select: { id: true, name: true } },
      },
    })
    if (!unit) throw new Error('This home is no longer available to rent.')
    if (!unit.baseRentMinor) throw new Error('This home does not have a monthly rent set.')

    const applicant = await findOrCreateApplicant(
      input.applicantName,
      input.applicantPhone,
      input.applicantEmail ?? null,
      tx
    )

    const application = await tx.tenancyApplication.create({
      data: {
        code: tenancyApplicationCode(),
        unitId: unit.id,
        propertyId: unit.property.id,
        applicantPartyId: applicant.id,
        applicantName: input.applicantName,
        applicantPhone: input.applicantPhone,
        applicantEmail: input.applicantEmail ?? null,
        ghanaCard: input.ghanaCard ?? null,
        employer: input.employer ?? null,
        moveInDate: input.moveInDate,
        leaseMonths: input.leaseMonths,
        notes: input.notes ?? null,
        status: 'NEW',
      },
    })

    return { application, unit }
  }

  const { application, unit } = await db.$transaction(run, TX_OPTS)

  await queueMessage({
    channel: 'EMAIL',
    to: input.applicantEmail ?? input.applicantPhone,
    subject: `ABN Homes — rental application received (${application.code})`,
    body:
      `Dear ${input.applicantName},\n\nThank you for applying to rent ${unit.name} at ${unit.property.name}. ` +
      `Your application code is ${application.code} — follow its progress at /track/${application.code}.\n\n` +
      `Our leasing team screens applications within two working days.\n\n— ABN Homes, Accra`,
    template: 'tenancy.application.received',
    entityType: 'TenancyApplication',
    entityId: application.id,
    dedupe: true,
  })
  await queueMessage({
    channel: 'EMAIL',
    to: 'leasing@abnhomes.example',
    subject: `[Leasing] New rental application ${application.code} — ${unit.name}`,
    body: `${input.applicantName} (${input.applicantPhone}) applied to rent ${unit.name}, moving in ${input.moveInDate.toISOString().slice(0, 10)} for ${input.leaseMonths} months. Review it in Operations → Applications.`,
    template: 'tenancy.application.staff',
    entityType: 'TenancyApplication',
    entityId: application.id,
    dedupe: true,
  })

  return application
}

type ApplicationContext = { actor: Actor; note?: string | null }

export async function screenApplication(id: string, { actor, note }: ApplicationContext) {
  const before = await db.tenancyApplication.findUnique({ where: { id } })
  if (!before) throw new Error('Application not found.')
  if (before.status !== 'NEW') throw new Error('Only a new application can move to screening.')

  const after = await db.tenancyApplication.update({
    where: { id },
    data: { status: 'SCREENING', reviewedById: actor.id, reviewedAt: new Date(), decisionNote: note ?? before.decisionNote },
  })
  await logAudit({
    actor,
    action: 'tenancy.screening',
    entityType: 'TenancyApplication',
    entityId: id,
    before: { status: before.status },
    after: { status: after.status },
  })
  return after
}

export async function approveTenancyApplication(id: string, { actor, note }: ApplicationContext) {
  const before = await db.tenancyApplication.findUnique({ where: { id } })
  if (!before) throw new Error('Application not found.')
  if (before.status !== 'NEW' && before.status !== 'SCREENING') {
    throw new Error('Only a new or screening application can be approved.')
  }

  const after = await db.tenancyApplication.update({
    where: { id },
    data: { status: 'APPROVED', reviewedById: actor.id, reviewedAt: new Date(), decisionNote: note ?? null },
  })
  await logAudit({
    actor,
    action: 'tenancy.approved',
    entityType: 'TenancyApplication',
    entityId: id,
    before: { status: before.status },
    after: { status: after.status, note: note ?? null },
  })
  await queueMessage({
    channel: 'EMAIL',
    to: after.applicantEmail ?? after.applicantPhone,
    subject: `ABN Homes — your rental application ${after.code} is approved`,
    body: `Congratulations, ${after.applicantName}. Your application has been approved. Our team will contact you to sign the lease and arrange your move-in.`,
    template: 'tenancy.approved',
    entityType: 'TenancyApplication',
    entityId: after.id,
    dedupe: true,
  })
  return after
}

export async function rejectTenancyApplication(id: string, { actor, note }: ApplicationContext) {
  const before = await db.tenancyApplication.findUnique({ where: { id } })
  if (!before) throw new Error('Application not found.')
  if (before.status === 'CONVERTED') throw new Error('A converted application cannot be rejected.')

  const after = await db.tenancyApplication.update({
    where: { id },
    data: { status: 'REJECTED', reviewedById: actor.id, reviewedAt: new Date(), decisionNote: note ?? null },
  })
  await logAudit({
    actor,
    action: 'tenancy.rejected',
    entityType: 'TenancyApplication',
    entityId: id,
    before: { status: before.status },
    after: { status: after.status, note: note ?? null },
  })
  return after
}

export async function withdrawTenancyApplication(id: string, { actor, note }: ApplicationContext) {
  const before = await db.tenancyApplication.findUnique({ where: { id } })
  if (!before) throw new Error('Application not found.')
  if (before.status === 'CONVERTED') throw new Error('A converted application cannot be withdrawn.')

  const after = await db.tenancyApplication.update({
    where: { id },
    data: { status: 'WITHDRAWN', decisionNote: note ?? before.decisionNote },
  })
  await logAudit({
    actor,
    action: 'tenancy.withdrawn',
    entityType: 'TenancyApplication',
    entityId: id,
    before: { status: before.status },
    after: { status: after.status, note: note ?? null },
  })
  return after
}

/**
 * Turn an approved application into a real lease via the standard engine.
 * The lease term runs from the requested move-in date for the requested
 * months. Activation is immediate: the unit moves to OCCUPIED and the rent
 * run picks it up on its next cycle.
 */
export async function convertApplicationToLease(
  id: string,
  { actor, note }: ApplicationContext,
  rentMinorOverride?: number
) {
  const application = await db.tenancyApplication.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, name: true, baseRentMinor: true, currency: true } },
    },
  })
  if (!application) throw new Error('Application not found.')
  if (application.status !== 'APPROVED') {
    throw new Error('Only an approved application can be converted to a lease.')
  }
  if (application.leaseId) throw new Error('This application already has a lease.')

  const rentMinor = rentMinorOverride ?? application.unit.baseRentMinor!
  const start = application.moveInDate
  const end = new Date(start)
  end.setMonth(end.getMonth() + application.leaseMonths)

  const lease = await createLease({
    unitId: application.unitId,
    tenant: {
      name: application.applicantName,
      phone: application.applicantPhone,
      email: application.applicantEmail,
      ghanaCard: application.ghanaCard,
    },
    startDate: start,
    endDate: end,
    rentMinor,
    currency: application.unit.currency,
    cycle: 'MONTHLY',
    dueDay: Math.min(28, Math.max(1, start.getDate())),
    depositMinor: rentMinor, // one month deposit, standard for ABN long lets
    advanceMonths: 0,
    escalationBasisPoints: 0,
    recurring: [],
    actorUserId: actor.id,
  })

  await activateLease(lease.id)

  const after = await db.tenancyApplication.update({
    where: { id },
    data: { status: 'CONVERTED', leaseId: lease.id, decisionNote: note ?? application.decisionNote },
  })

  await logAudit({
    actor,
    action: 'tenancy.converted',
    entityType: 'TenancyApplication',
    entityId: id,
    after: { status: 'CONVERTED', leaseId: lease.id, leaseCode: lease.code, rentMinor },
  })
  await queueMessage({
    channel: 'EMAIL',
    to: after.applicantEmail ?? after.applicantPhone,
    subject: `ABN Homes — welcome home! Lease ${lease.code} is active`,
    body: `Dear ${after.applicantName}, your lease for ${application.unit.name} is active from ${start.toISOString().slice(0, 10)}. Your tenant portal is ready: sign in at /portal with your phone number.`,
    template: 'tenancy.converted',
    entityType: 'TenancyApplication',
    entityId: after.id,
    dedupe: true,
  })
  return { application: after, lease }
}

// Re-export so the admin page can build lease codes without importing ids.ts directly.
export { leaseCode }
