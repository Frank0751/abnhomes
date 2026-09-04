'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireParty } from '@/lib/session'
import { createTicket } from '@/lib/operations/tickets'
import { startPayment } from '@/lib/payments/gateway'
import type { PaymentChannel } from '@prisma/client'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * A tenant reporting a fault.
 *
 * Access is checked against their own lease, not against a property id they
 * sent us — otherwise anyone could raise tickets on any building.
 */
export async function reportFaultAction(formData: FormData): Promise<ActionResult> {
  try {
    const { partyId } = await requireParty()

    const unitId = String(formData.get('unitId') ?? '')
    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const category = String(formData.get('category') ?? 'OTHER')
    const priority = String(formData.get('priority') ?? 'NORMAL') as
      | 'LOW'
      | 'NORMAL'
      | 'HIGH'
      | 'EMERGENCY'

    if (title.length < 3) return { ok: false, error: 'Give the problem a short title.' }
    if (description.length < 5) return { ok: false, error: 'Tell us a little more.' }

    const lease = await db.lease.findFirst({
      where: { tenantPartyId: partyId, unitId, status: 'ACTIVE' },
      include: { unit: { select: { propertyId: true } } },
    })

    if (!lease) {
      return { ok: false, error: 'We could not match that unit to your tenancy.' }
    }

    const ticket = await createTicket({
      propertyId: lease.unit.propertyId,
      unitId,
      title,
      description,
      category: category as never,
      priority,
      reporterPartyId: partyId,
    })

    revalidatePath('/portal/tenant')
    return {
      ok: true,
      message: `Logged as ${ticket.code}. We will text you as it progresses.`,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not report it.' }
  }
}

/** Start an online payment for whatever the tenant currently owes. */
export async function startTenantPaymentAction(
  amountMinor: number,
  channel: PaymentChannel
): Promise<{ ok: true; redirectUrl: string; simulated: boolean } | { ok: false; error: string }> {
  try {
    const { partyId } = await requireParty()

    const lease = await db.lease.findFirst({
      where: { tenantPartyId: partyId, status: 'ACTIVE' },
      include: { unit: { select: { propertyId: true } } },
    })
    if (!lease) return { ok: false, error: 'No active tenancy found on your account.' }

    if (amountMinor <= 0) return { ok: false, error: 'There is nothing to pay.' }

    const result = await startPayment({
      propertyId: lease.unit.propertyId,
      partyId,
      amountMinor,
      currency: 'GHS',
      channel,
      metadata: { purpose: 'Rent payment from the tenant portal' },
    })

    return { ok: true, redirectUrl: result.redirectUrl, simulated: result.simulated }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not start the payment.',
    }
  }
}
