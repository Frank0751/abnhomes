'use server'

import { revalidatePath } from 'next/cache'
import { requireActor } from '@/lib/session'
import { assertCanOnProperty, assertCan } from '@/lib/rbac'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { computeStatement, issueStatement, markStatementPaid } from '@/lib/reporting/statements'
import { formatMinor } from '@/lib/core/money'
import { sendSms, templates } from '@/lib/messaging'
import { formatMonthYear } from '@/lib/core/dates'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/** Preview before issuing. An owner statement is not something to guess at. */
export async function previewStatementAction(
  propertyId: string,
  periodStart: string,
  periodEnd: string
) {
  const actor = await requireActor()
  assertCanOnProperty(actor, 'owners:read', propertyId)

  const computed = await computeStatement({
    propertyId,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
  })

  return {
    propertyName: computed.propertyName,
    ownerName: computed.ownerName,
    currency: computed.currency,
    grossRevenueMinor: computed.grossRevenueMinor,
    managementFeeMinor: computed.managementFeeMinor,
    expensesMinor: computed.expensesMinor,
    netPayableMinor: computed.netPayableMinor,
    lineCount: computed.lines.length,
  }
}

export async function issueStatementAction(
  propertyId: string,
  periodStart: string,
  periodEnd: string
): Promise<ActionResult> {
  try {
    const actor = await requireActor()
    assertCanOnProperty(actor, 'owners:manage', propertyId)

    const statement = await issueStatement({
      propertyId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      actorUserId: actor.id,
    })

    const owner = await db.party.findUnique({ where: { id: statement.ownerPartyId } })
    if (owner?.phone) {
      await sendSms({
        to: owner.phone,
        body: templates.ownerStatement(
          owner.name.split(' ')[0],
          formatMonthYear(statement.periodStart),
          formatMinor(statement.netPayableMinor, statement.currency)
        ),
        template: 'owner_statement',
        entityType: 'OwnerStatement',
        entityId: statement.id,
      })
    }

    await logAudit({
      actor,
      action: 'statement.issued',
      entityType: 'OwnerStatement',
      entityId: statement.id,
      after: { code: statement.code, net: statement.netPayableMinor },
    })

    revalidatePath('/admin/owners')
    revalidatePath('/portal/owner')

    return {
      ok: true,
      message: `${statement.code} issued — ${formatMinor(statement.netPayableMinor, statement.currency)} due to the owner.`,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not issue it.' }
  }
}

export async function markStatementPaidAction(statementId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor()
    assertCan(actor, 'owners:manage')

    const statement = await db.ownerStatement.findUniqueOrThrow({ where: { id: statementId } })
    assertCanOnProperty(actor, 'owners:manage', statement.propertyId)

    const updated = await markStatementPaid(statementId, actor.id)

    // The payout record makes the transfer visible in the owner's own portal,
    // not just in the ledger.
    await db.payout.create({
      data: {
        code: `PYT-${Date.now().toString(36).toUpperCase()}`,
        ownerPartyId: statement.ownerPartyId,
        propertyId: statement.propertyId,
        statementId: statement.id,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        amountMinor: statement.netPayableMinor,
        currency: statement.currency,
        method: 'BANK_TRANSFER',
        status: 'PAID',
        paidAt: updated.paidAt ?? new Date(),
        notes: `Settled against statement ${statement.code}`,
      },
    })

    await logAudit({
      actor,
      action: 'statement.paid',
      entityType: 'OwnerStatement',
      entityId: statementId,
      after: { paidAt: updated.paidAt },
    })

    revalidatePath('/admin/owners')
    revalidatePath('/portal/owner')
    return { ok: true, message: `${statement.code} marked paid and logged as a payout.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update it.' }
  }
}
