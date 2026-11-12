/**
 * Sales & applications demo data.
 *
 * Idempotent: keyed off fixed codes, so re-running never duplicates. It
 * builds the whole story the platform tells:
 *   - three homes on the market (for-sale, with prices)
 *   - one fresh purchase application (review it in Applications)
 *   - one contracted sale with a real payment plan and two installments paid
 *   - rental applications at every stage: one new, one screening, one approved
 *
 * Run: npx tsx prisma/seed-sales.ts
 */

import { PrismaClient } from '@prisma/client'
import { recordPayment } from '../src/lib/core/ledger'
import { phoneVariants } from '../src/lib/core/phone'

const db = new PrismaClient()

function code(prefix: string, suffix: string) {
  return `${prefix}-${suffix}`
}

async function findOrCreateParty(name: string, phone: string, email: string, flags: { isTenant?: boolean; isOwner?: boolean }) {
  const variants = phoneVariants(phone)
  const existing = await db.party.findFirst({ where: { OR: variants.map((p) => ({ phone: p })) } })
  if (existing) {
    return db.party.update({ where: { id: existing.id }, data: { ...flags } })
  }
  return db.party.create({
    data: { type: 'PERSON', name, phone: `+233${phone.replace(/^0/, '')}`, email, ...flags },
  })
}

async function main() {
  const admin = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN', active: true },
    select: { id: true, name: true },
  })
  if (!admin) throw new Error('Run seed.ts first — no SUPER_ADMIN found.')
  const actor = { id: admin.id, role: 'SUPER_ADMIN' as const, propertyIds: [] as string[], partyId: null }

  // -----------------------------------------------------------------------
  // Homes on the market
  // -----------------------------------------------------------------------
  const forSale: Array<{
    unitCode: string
    priceMinor: number
    blurb: string
  }> = [
    { unitCode: 'PH', priceMinor: 325_000_000, blurb: 'Top-floor penthouse with rooftop terrace and skyline views over Tantra Hill.' },
    { unitCode: 'A1', priceMinor: 210_000_000, blurb: 'Four-bedroom ensuite family home in a quiet estate, generator-backed.' },
    { unitCode: 'B2', priceMinor: 78_000_000, blurb: 'Compact, fully furnished one-bedroom — the easiest first home in the portfolio.' },
  ]

  const saleUnits: Record<string, { id: string; propertyId: string; saleCurrency: 'GHS' }> = {}
  for (const s of forSale) {
    const unit = await db.unit.findFirst({ where: { code: s.unitCode, published: true }, include: { property: true } })
    if (!unit) continue
    await db.unit.update({
      where: { id: unit.id },
      data: { forSale: true, salePriceMinor: s.priceMinor, saleCurrency: 'GHS', saleBlurb: s.blurb, status: unit.status === 'OCCUPIED' ? 'AVAILABLE' : unit.status },
    })
    saleUnits[s.unitCode] = { id: unit.id, propertyId: unit.propertyId, saleCurrency: 'GHS' }
  }
  // Top up to three homes on the market from whatever inventory exists.
  if (Object.keys(saleUnits).length < 3) {
    const extra = await db.unit.findFirst({
      where: { published: true, forSale: false, status: 'AVAILABLE' },
      include: { property: true },
    })
    if (extra) {
      await db.unit.update({
        where: { id: extra.id },
        data: { forSale: true, salePriceMinor: 89_000_000, saleCurrency: 'GHS', saleBlurb: 'Garden-facing home, freshly refreshed — the friendly one in the portfolio.' },
      })
      saleUnits['EXTRA'] = { id: extra.id, propertyId: extra.propertyId, saleCurrency: 'GHS' }
    }
  }
  console.log(`for-sale homes: ${Object.keys(saleUnits).length}`)

  // -----------------------------------------------------------------------
  // Purchase journey 1 — fresh application, awaiting review
  // -----------------------------------------------------------------------
  const freshBuyer = await findOrCreateParty('Kojo Aidoo', '020 933 7712', 'kojo.aidoo@example.com', { isOwner: true })
  const freshUnit = saleUnits['B2'] ?? saleUnits['EXTRA']
  if (freshUnit) {
    const freshRow = await db.unit.findUnique({ where: { id: freshUnit.id }, select: { salePriceMinor: true } })
    const existingFresh = await db.purchase.findUnique({ where: { code: code('OWN', 'TAN7Q4') } })
    if (!existingFresh && freshRow?.salePriceMinor) {
      const purchase = await db.purchase.create({
        data: {
          code: code('OWN', 'TAN7Q4'),
          unitId: freshUnit.id,
          propertyId: freshUnit.propertyId,
          buyerPartyId: freshBuyer.id,
          buyerName: 'Kojo Aidoo',
          buyerPhone: '+233209337712',
          buyerEmail: 'kojo.aidoo@example.com',
          buyerNotes: 'First-time buyer. Would love a 36-month plan and to view the unit this weekend.',
          currency: 'GHS',
          offerMinor: freshRow.salePriceMinor,
          status: 'APPLICATION',
        },
      })
      await db.auditEvent.create({
        data: {
          actorLabel: 'public:+233209337712',
          action: 'purchase.applied',
          entityType: 'Purchase',
          entityId: purchase.id,
          after: { code: purchase.code, seeded: true },
        },
      })
    }
  }

  // -----------------------------------------------------------------------
  // Purchase journey 2 — contracted, plan posted, two installments paid
  // -----------------------------------------------------------------------
  const penthouse = saleUnits['PH']
  const seriousBuyer = await findOrCreateParty('Abena Ofori-Atta', '024 555 0107', 'abena.oa@example.com', { isOwner: true })
  if (penthouse) {
    const contractedCode = code('OWN', 'K4M9XD')
    let contracted = await db.purchase.findUnique({ where: { code: contractedCode } })
    if (!contracted) {
      contracted = await db.purchase.create({
        data: {
          code: contractedCode,
          unitId: penthouse.id,
          propertyId: penthouse.propertyId,
          buyerPartyId: seriousBuyer.id,
          buyerName: 'Abena Ofori-Atta',
          buyerPhone: '+233245550107',
          buyerEmail: 'abena.oa@example.com',
          currency: 'GHS',
          offerMinor: 325_000_000,
          status: 'CONTRACTED',
          reviewedById: admin.id,
          reviewedAt: new Date(Date.now() - 12 * 86400_000),
          contractedAt: new Date(Date.now() - 10 * 86400_000),
          plan: [
            { label: 'Deposit', amountMinor: 65_000_000, dueDate: new Date(Date.now() - 10 * 86400_000).toISOString().slice(0, 10) },
            { label: 'Installment 1 of 24', amountMinor: 10_833_333, dueDate: new Date(Date.now() + 20 * 86400_000).toISOString().slice(0, 10) },
            ...Array.from({ length: 23 }, (_, i) => ({
              label: `Installment ${i + 2} of 24`,
              amountMinor: 10_833_334,
              dueDate: new Date(Date.now() + (20 + (i + 1) * 30) * 86400_000).toISOString().slice(0, 10),
            })),
          ] as never,
        },
      })

      await db.auditEvent.create({
        data: {
          actorUserId: admin.id,
          action: 'purchase.contracted',
          entityType: 'Purchase',
          entityId: contracted.id,
          after: { status: 'CONTRACTED', installments: 24, seeded: true },
        },
      })

      // Post the charges the plan implies: deposit + 24 installments.
      const planLines = [
        { label: 'Deposit', amountMinor: 65_000_000, dueOffsetDays: -10 },
        ...Array.from({ length: 24 }, (_, i) => ({
          label: `Installment ${i + 1} of 24`,
          amountMinor: i === 23 ? 10_833_325 : i === 0 ? 10_833_333 : 10_833_334,
          dueOffsetDays: 20 + i * 30,
        })),
      ]
      for (const [i, line] of planLines.entries()) {
        const { postCharge } = await import('../src/lib/core/ledger')
        await postCharge({
          propertyId: penthouse.propertyId,
          unitId: penthouse.id,
          partyId: seriousBuyer.id,
          purchaseId: contracted.id,
          type: 'OTHER',
          description: `${line.label} — ${contractedCode}`,
          amountMinor: line.amountMinor,
          currency: 'GHS',
          dueDate: new Date(Date.now() + line.dueOffsetDays * 86400_000),
          runKey: `purchase:${contracted.id}:${i}`,
        }, undefined as never)
      }

      // Two payments: the deposit and installment 1. These hit the revenue trend.
      const { payment: p1 } = await recordPayment({
        propertyId: penthouse.propertyId,
        partyId: seriousBuyer.id,
        amountMinor: 65_000_000,
        currency: 'GHS',
        channel: 'BANK_TRANSFER',
        reference: `Deposit — sale ${contractedCode}`,
        recordedById: admin.id,
        status: 'CONFIRMED',
        receivedAt: new Date(Date.now() - 9 * 86400_000),
      })
      const { payment: p2 } = await recordPayment({
        propertyId: penthouse.propertyId,
        partyId: seriousBuyer.id,
        amountMinor: 10_833_333,
        currency: 'GHS',
        channel: 'MOMO_MTN',
        reference: `Installment 1 — sale ${contractedCode}`,
        recordedById: admin.id,
        status: 'CONFIRMED',
        receivedAt: new Date(Date.now() - 2 * 86400_000),
      })
      await db.auditEvent.createMany({
        data: [
          { actorUserId: admin.id, action: 'purchase.payment.recorded', entityType: 'Purchase', entityId: contracted.id, after: { receipt: p1.receiptNumber, seeded: true } },
          { actorUserId: admin.id, action: 'purchase.payment.recorded', entityType: 'Purchase', entityId: contracted.id, after: { receipt: p2.receiptNumber, seeded: true } },
        ],
      })
      console.log(`contracted sale ${contractedCode}: plan posted, 2 payments recorded`)
    }
  }

  // -----------------------------------------------------------------------
  // Rental applications at three stages
  // -----------------------------------------------------------------------
  const rentable = await db.unit.findMany({
    where: { published: true, lettingMode: { in: ['LONG_LET', 'BOTH'] }, status: 'AVAILABLE', baseRentMinor: { not: null }, leases: { none: { status: 'ACTIVE' } } },
    include: { property: true },
    take: 3,
  })

  const stages = [
    { suffix: 'QW3TB', name: 'Yaw Mensah', phone: '055 211 8890', email: 'yaw.mensah@example.com', status: 'NEW' as const, employer: 'Rowi Ventures, Accra', months: 12, idx: 0 },
    { suffix: '8HD2VL', name: 'Nana Adjoa Boateng', phone: '027 700 4315', email: 'adjoa.boateng@example.com', status: 'SCREENING' as const, employer: 'Ghana Health Service', months: 24, idx: 1 },
    { suffix: '5RP8KN', name: 'Selorm Agbeko', phone: '020 118 2256', email: 'selorm.agbeko@example.com', status: 'APPROVED' as const, employer: 'Freelance software engineer', months: 12, idx: 2 },
  ]

  for (const stage of stages) {
    // Fewer rentable units than stages: reuse the first rentable one rather
    // than dropping a stage — two applications on one home is realistic.
    const unit = rentable[stage.idx] ?? rentable[0]
    if (!unit) continue
    const existing = await db.tenancyApplication.findUnique({ where: { code: code('RNT', stage.suffix) } })
    if (existing) continue
    const party = await findOrCreateParty(stage.name, stage.phone, stage.email, { isTenant: true })
    const application = await db.tenancyApplication.create({
      data: {
        code: code('RNT', stage.suffix),
        unitId: unit.id,
        propertyId: unit.propertyId,
        applicantPartyId: party.id,
        applicantName: stage.name,
        applicantPhone: `+233${stage.phone.replace(/^0/, '')}`,
        applicantEmail: stage.email,
        employer: stage.employer,
        moveInDate: new Date(Date.now() + 21 * 86400_000),
        leaseMonths: stage.months,
        notes: stage.status === 'NEW' ? 'Two adults, one toddler. Would like the cot to stay.' : null,
        status: stage.status,
        reviewedById: stage.status === 'NEW' ? null : admin.id,
        reviewedAt: stage.status === 'NEW' ? null : new Date(Date.now() - 3 * 86400_000),
      },
    })
    await db.auditEvent.create({
      data: {
        actorLabel: 'public:+233' + stage.phone.replace(/^0/, ''),
        action: 'tenancy.applied',
        entityType: 'TenancyApplication',
        entityId: application.id,
        after: { code: application.code, seeded: true },
      },
    })
  }
  console.log(`rental applications ensured: ${stages.length}`)

  console.log('—— sales seed complete ——')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
