'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireActor, requirePermission } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { activateLease, createLease } from '@/lib/long-let/leases'
import { applyLateFees, runRentCycle } from '@/lib/long-let/rent-run'
import { toMinor } from '@/lib/core/money'
import { recordPayment } from '@/lib/core/ledger'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/** Rehearsal. Nothing is written; the operator sees exactly what would be. */
export async function previewRentRunAction() {
  await requirePermission('rentrun:execute')
  const result = await runRentCycle({ dryRun: true })
  const fees = await applyLateFees({ dryRun: true })

  return {
    charges: result.chargedCount,
    skipped: result.skippedCount,
    totals: result.totalByCurrency,
    lateFees: fees.applied,
    lateFeeTotal: fees.totalMinor,
    lines: result.lines
      .filter((l) => !l.alreadyBilled)
      .slice(0, 50)
      .map((l) => ({
        tenant: l.tenantName,
        unit: l.unitName,
        description: l.description,
        amountMinor: l.amountMinor,
        currency: l.currency,
      })),
  }
}

export async function executeRentRunAction(): Promise<ActionResult> {
  try {
    const actor = await requirePermission('rentrun:execute')

    const result = await runRentCycle({ dryRun: false, actorUserId: actor.id })
    const fees = await applyLateFees({ dryRun: false, actorUserId: actor.id })

    await logAudit({
      actor,
      action: 'rentrun.executed.manual',
      entityType: 'System',
      entityId: 'rent-run',
      after: { charges: result.chargedCount, lateFees: fees.applied },
    })

    revalidatePath('/admin/leases')
    revalidatePath('/admin/arrears')
    revalidatePath('/admin/money')

    return {
      ok: true,
      message:
        result.chargedCount === 0
          ? 'Nothing new to raise — every period due has already been billed.'
          : `${result.chargedCount} charge${result.chargedCount === 1 ? '' : 's'} raised${
              fees.applied > 0 ? `, ${fees.applied} late fee${fees.applied === 1 ? '' : 's'} applied` : ''
            }.`,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The run failed.' }
  }
}

const leaseSchema = z.object({
  unitId: z.string().min(1, 'Choose a unit.'),
  tenantName: z.string().min(2, 'Enter the tenant name.'),
  tenantPhone: z.string().optional(),
  tenantEmail: z.string().email('That email does not look right.').optional().or(z.literal('')),
  ghanaCard: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  rent: z.coerce.number().positive('Rent must be more than zero.'),
  cycle: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL']),
  dueDay: z.coerce.number().int().min(1).max(28),
  deposit: z.coerce.number().min(0),
  advanceMonths: z.coerce.number().int().min(0).max(60),
  escalationPercent: z.coerce.number().min(0).max(100),
  serviceChargeLabel: z.string().optional(),
  serviceCharge: z.coerce.number().min(0).optional(),
  advancePaid: z.string().optional(),
  activate: z.string().optional(),
})

export async function createLeaseAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const actor = await requireActor()
  const parsed = leaseSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }
  }
  const input = parsed.data

  const unit = await db.unit.findUnique({
    where: { id: input.unitId },
    select: { propertyId: true, name: true },
  })
  if (!unit) return { ok: false, error: 'That unit no longer exists.' }

  let leaseId: string

  try {
    assertCanOnProperty(actor, 'leases:write', unit.propertyId)

    const lease = await createLease({
      unitId: input.unitId,
      tenant: {
        name: input.tenantName,
        phone: input.tenantPhone || null,
        email: input.tenantEmail || null,
        ghanaCard: input.ghanaCard || null,
      },
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      rentMinor: toMinor(input.rent, 'GHS'),
      currency: 'GHS',
      cycle: input.cycle,
      dueDay: input.dueDay,
      depositMinor: toMinor(input.deposit, 'GHS'),
      advanceMonths: input.advanceMonths,
      escalationBasisPoints: Math.round(input.escalationPercent * 100),
      recurring:
        input.serviceCharge && input.serviceCharge > 0
          ? [
              {
                label: input.serviceChargeLabel || 'Service charge',
                amountMinor: toMinor(input.serviceCharge, 'GHS'),
                type: 'SERVICE_CHARGE',
              },
            ]
          : [],
      actorUserId: actor.id,
    })
    leaseId = lease.id

    if (input.activate === 'on') {
      await activateLease(lease.id)
    }

    // Record the advance up front, if it has already been handed over. It sits
    // as credit and is consumed month by month by the rent run.
    if (input.advancePaid === 'on' && input.advanceMonths > 0) {
      await recordPayment({
        propertyId: unit.propertyId,
        partyId: lease.tenantPartyId,
        amountMinor: toMinor(input.rent, 'GHS') * input.advanceMonths,
        currency: 'GHS',
        channel: 'BANK_TRANSFER',
        reference: `Advance rent, ${input.advanceMonths} months — lease ${lease.code}`,
        recordedById: actor.id,
        status: 'CONFIRMED',
      })
    }

    await logAudit({
      actor,
      action: 'lease.created',
      entityType: 'Lease',
      entityId: lease.id,
      after: { code: lease.code, unit: unit.name, rent: input.rent },
    })

    revalidatePath('/admin/leases')
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create the lease.',
    }
  }

  redirect(`/admin/leases?created=${leaseId}`)
}
