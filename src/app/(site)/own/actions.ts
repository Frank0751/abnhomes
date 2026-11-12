'use server'

import { z } from 'zod'
import { createPurchaseApplication } from '@/lib/sales/purchases'
import { logAudit } from '@/lib/audit'

export type ApplyResult =
  | { ok: true; code: string }
  | { ok: false; error: string }

const purchaseSchema = z.object({
  unitId: z.string().min(1, 'Missing home.'),
  name: z.string().min(2, 'Tell us your full name.'),
  phone: z.string().min(9, 'Enter a phone number we can reach you on.'),
  email: z.string().email('That email does not look right.').optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  /** Honeypot: bots fill every field; humans never see this one. */
  company: z.string().max(0).optional().or(z.literal('')),
})

export async function applyToBuyAction(_prev: ApplyResult | null, formData: FormData): Promise<ApplyResult> {
  const parsed = purchaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }
  }
  if (parsed.data.company) return { ok: false, error: 'Submission blocked.' }

  try {
    const purchase = await createPurchaseApplication({
      unitId: parsed.data.unitId,
      buyerName: parsed.data.name,
      buyerPhone: parsed.data.phone,
      buyerEmail: parsed.data.email || null,
      buyerNotes: parsed.data.notes || null,
    })
    // Public submissions are part of the trail too — actorless, labelled.
    await logAudit({
      actorLabel: `public:${parsed.data.phone}`,
      action: 'purchase.applied',
      entityType: 'Purchase',
      entityId: purchase.id,
      after: { code: purchase.code, unitId: parsed.data.unitId },
    })
    return { ok: true, code: purchase.code }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not submit your application. Please try again.',
    }
  }
}
