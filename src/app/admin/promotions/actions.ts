'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { toMinor } from '@/lib/core/money'

export type PromoResult = { ok: true; message: string } | { ok: false; error: string }

const schema = z.object({
  code: z
    .string()
    .min(3, 'Codes are at least 3 characters.')
    .max(24)
    .regex(/^[A-Z0-9]+$/, 'Capital letters and numbers only.'),
  kind: z.enum(['PERCENT', 'FIXED']),
  percent: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
  currency: z.enum(['GHS', 'USD']),
  minSpend: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  maxRedemptions: z.coerce.number().int().optional(),
  firstBookingOnly: z.string().optional(),
  note: z.string().max(200).optional(),
})

export async function createCouponAction(formData: FormData): Promise<PromoResult> {
  const actor = await requirePermission('promotions:manage')
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }

  const d = parsed.data
  if (d.kind === 'PERCENT' && !(d.percent && d.percent > 0 && d.percent <= 100)) {
    return { ok: false, error: 'Enter a percentage between 1 and 100.' }
  }
  if (d.kind === 'FIXED' && !(d.amount && d.amount > 0)) {
    return { ok: false, error: 'Enter the discount amount.' }
  }

  const coupon = await db.coupon.create({
    data: {
      code: d.code,
      kind: d.kind,
      value: d.kind === 'PERCENT' ? Math.round(d.percent! * 100) : toMinor(d.amount!, d.currency),
      currency: d.currency,
      minSpendMinor: toMinor(d.minSpend, d.currency),
      maxDiscountMinor: d.maxDiscount ? toMinor(d.maxDiscount, d.currency) : null,
      startsAt: d.startsAt ? new Date(d.startsAt) : null,
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      maxRedemptions: d.maxRedemptions || null,
      firstBookingOnly: d.firstBookingOnly === 'on',
      note: d.note || null,
    },
  })

  await logAudit({
    actor,
    action: 'coupon.created',
    entityType: 'Coupon',
    entityId: coupon.id,
    after: { code: coupon.code, kind: coupon.kind, value: coupon.value },
  })
  revalidatePath('/admin/promotions')
  return { ok: true, message: `Code ${coupon.code} is live.` }
}

export async function toggleCouponAction(id: string): Promise<PromoResult> {
  const actor = await requirePermission('promotions:manage')

  const coupon = await db.coupon.findUniqueOrThrow({ where: { id } })
  await db.coupon.update({ where: { id }, data: { active: !coupon.active } })
  await logAudit({
    actor,
    action: coupon.active ? 'coupon.paused' : 'coupon.resumed',
    entityType: 'Coupon',
    entityId: id,
  })
  revalidatePath('/admin/promotions')
  return { ok: true, message: coupon.active ? `${coupon.code} paused.` : `${coupon.code} live again.` }
}
