'use server'

import { z } from 'zod'
import { createTenancyApplication } from '@/lib/sales/applications'
import { logAudit } from '@/lib/audit'

export type RentApplyResult =
  | { ok: true; code: string }
  | { ok: false; error: string }

const rentSchema = z.object({
  unitId: z.string().min(1, 'Missing home.'),
  name: z.string().min(2, 'Tell us your full name.'),
  phone: z.string().min(9, 'Enter a phone number we can reach you on.'),
  email: z.string().email('That email does not look right.').optional().or(z.literal('')),
  ghanaCard: z
    .string()
    .regex(/^GHA-\d{9}-\d$/, 'Ghana Card looks like GHA-123456789-0.')
    .optional()
    .or(z.literal('')),
  employer: z.string().max(200).optional().or(z.literal('')),
  moveIn: z.string().min(1, 'Choose your move-in date.'),
  months: z.coerce.number().int().min(3, 'Minimum lease is 3 months.').max(60, 'Maximum lease is 60 months.'),
  notes: z.string().max(2000).optional().or(z.literal('')),
  /** Honeypot. */
  company: z.string().max(0).optional().or(z.literal('')),
})

export async function applyToRentAction(_prev: RentApplyResult | null, formData: FormData): Promise<RentApplyResult> {
  const parsed = rentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }
  }
  if (parsed.data.company) return { ok: false, error: 'Submission blocked.' }

  try {
    const application = await createTenancyApplication({
      unitId: parsed.data.unitId,
      applicantName: parsed.data.name,
      applicantPhone: parsed.data.phone,
      applicantEmail: parsed.data.email || null,
      ghanaCard: parsed.data.ghanaCard || null,
      employer: parsed.data.employer || null,
      moveInDate: new Date(parsed.data.moveIn),
      leaseMonths: parsed.data.months,
      notes: parsed.data.notes || null,
    })
    await logAudit({
      actorLabel: `public:${parsed.data.phone}`,
      action: 'tenancy.applied',
      entityType: 'TenancyApplication',
      entityId: application.id,
      after: { code: application.code, unitId: parsed.data.unitId },
    })
    return { ok: true, code: application.code }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not submit your application. Please try again.',
    }
  }
}
