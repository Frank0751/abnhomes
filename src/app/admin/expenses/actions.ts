'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { toMinor } from '@/lib/core/money'
import { postEntry } from '@/lib/core/ledger'

export type ExpenseResult = { ok: true; message: string } | { ok: false; error: string }

const schema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().optional(),
  category: z.string().min(1),
  description: z.string().min(2, 'What was bought?').max(300),
  amount: z.coerce.number().positive('Enter an amount.'),
  currency: z.enum(['GHS', 'USD']),
  incurredAt: z.string().min(1),
  vendorPartyId: z.string().optional(),
})

/** Capture an operating expense. Money leaves as an EXPENSE debit against the property. */
export async function createExpenseAction(formData: FormData): Promise<ExpenseResult> {
  const actor = await requirePermission('money:record')
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }

  const { propertyId, amount, currency } = parsed.data
  assertCanOnProperty(actor, 'money:record', propertyId)

  const expense = await db.expense.create({
    data: {
      code: `EXP-${Date.now().toString(36).toUpperCase()}`,
      propertyId,
      unitId: parsed.data.unitId || null,
      category: parsed.data.category as never,
      description: parsed.data.description,
      amountMinor: toMinor(amount, currency),
      currency,
      incurredAt: new Date(parsed.data.incurredAt),
      vendorPartyId: parsed.data.vendorPartyId || null,
    },
  })

  await logAudit({
    actor,
    action: 'expense.created',
    entityType: 'Expense',
    entityId: expense.id,
    after: { code: expense.code, amountMinor: expense.amountMinor, category: expense.category },
  })

  revalidatePath('/admin/expenses')
  return { ok: true, message: `Expense ${expense.code} recorded.` }
}

/**
 * Approve an expense: posts the EXPENSE ledger debit so it reaches owner
 * statements and the P&L. Unapproved expenses are still draft entries.
 */
export async function approveExpenseAction(expenseId: string): Promise<ExpenseResult> {
  const actor = await requirePermission('money:adjust')

  const expense = await db.expense.findUniqueOrThrow({ where: { id: expenseId } })
  assertCanOnProperty(actor, 'money:adjust', expense.propertyId)

  if (expense.approvedAt) return { ok: false, error: 'Already approved.' }

  await db.expense.update({
    where: { id: expenseId },
    data: { approvedAt: new Date(), approvedById: actor.id },
  })

  await postEntry({
    propertyId: expense.propertyId,
    unitId: expense.unitId,
    partyId: expense.vendorPartyId,
    direction: 'DEBIT',
    kind: 'EXPENSE',
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    description: `${expense.category.toLowerCase()} — ${expense.description} (${expense.code})`,
    occurredAt: expense.incurredAt,
    actorUserId: actor.id,
  })

  await logAudit({
    actor,
    action: 'expense.approved',
    entityType: 'Expense',
    entityId: expenseId,
  })
  revalidatePath('/admin/expenses')
  return { ok: true, message: `Expense ${expense.code} approved and posted.` }
}
