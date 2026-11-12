/**
 * Ensures the E2E run always has the rows it needs, whatever previous runs did:
 *   - one purchase in APPLICATION status (to approve + contract)
 *   - one tenancy application in APPROVED status (to convert to a lease)
 * Idempotent: creates only what is missing.
 *
 * Run: npx tsx scripts/e2e-reset.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // --- purchase application ---
  const openApplication = await db.purchase.findFirst({ where: { status: 'APPLICATION' } })
  if (!openApplication) {
    const unit = await db.unit.findFirst({
      where: { published: true, forSale: true, status: { notIn: ['SOLD', 'OFF_MARKET'] } },
      include: { property: { select: { id: true } } },
    })
    if (!unit) throw new Error('No for-sale unit available for the E2E fixture.')
    const phone = '+233209337712'
    let party = await db.party.findFirst({ where: { phone } })
    party ??= await db.party.create({
      data: { type: 'PERSON', name: 'Kojo Aidoo', phone, email: 'kojo.aidoo@example.com', isOwner: true },
    })
    const purchase = await db.purchase.create({
      data: {
        code: `OWN-E2E${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        unitId: unit.id,
        propertyId: unit.propertyId,
        buyerPartyId: party.id,
        buyerName: 'Kojo Aidoo',
        buyerPhone: phone,
        buyerEmail: 'kojo.aidoo@example.com',
        currency: 'GHS',
        offerMinor: unit.salePriceMinor ?? 100_000_000,
        status: 'APPLICATION',
      },
    })
    console.log('created fresh purchase application', purchase.code)
  } else {
    console.log('purchase application already open:', openApplication.code)
  }

  // --- approved tenancy application ---
  const approved = await db.tenancyApplication.findFirst({ where: { status: 'APPROVED' } })
  if (!approved) {
    let unit = await db.unit.findFirst({
      where: {
        published: true,
        lettingMode: { in: ['LONG_LET', 'BOTH'] },
        status: 'AVAILABLE',
        baseRentMinor: { not: null },
        leases: { none: { status: 'ACTIVE' } },
      },
      include: { property: { select: { id: true } } },
    })
    if (!unit) {
      // Every rentable unit is occupied — by previous E2E runs' conversions.
      // Recycle the oldest fixture lease so the journey stays re-runnable.
      const fixtureParty = await db.party.findFirst({ where: { email: 'e2e.convert@example.com' } })
      if (fixtureParty) {
        const fixtureLease = await db.lease.findFirst({
          where: { tenantPartyId: fixtureParty.id, status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        })
        if (fixtureLease) {
          await db.lease.update({
            where: { id: fixtureLease.id },
            data: { status: 'ENDED', endedAt: new Date(), endReason: 'E2E fixture recycled' },
          })
          await db.unit.update({ where: { id: fixtureLease.unitId }, data: { status: 'AVAILABLE' } })
          console.log('recycled fixture lease', fixtureLease.code)
        }
      }
      unit = await db.unit.findFirst({
        where: {
          published: true,
          lettingMode: { in: ['LONG_LET', 'BOTH'] },
          status: 'AVAILABLE',
          baseRentMinor: { not: null },
          leases: { none: { status: 'ACTIVE' } },
        },
        include: { property: { select: { id: true } } },
      })
    }
    if (!unit) throw new Error('No rentable unit available for the E2E fixture.')
    const phone = '+233246115590'
    let party = await db.party.findFirst({ where: { phone } })
    party ??= await db.party.create({
      data: { type: 'PERSON', name: 'E2E Convertee', phone, email: 'e2e.convert@example.com', isTenant: true },
    })
    const admin = await db.user.findFirstOrThrow({ where: { role: 'SUPER_ADMIN' } })
    const application = await db.tenancyApplication.create({
      data: {
        code: `RNT-E2E${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        unitId: unit.id,
        propertyId: unit.propertyId,
        applicantPartyId: party.id,
        applicantName: 'E2E Convertee',
        applicantPhone: phone,
        applicantEmail: 'e2e.convert@example.com',
        moveInDate: new Date(Date.now() + 30 * 86400_000),
        leaseMonths: 12,
        status: 'APPROVED',
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    })
    console.log('created approved tenancy application', application.code)
  } else {
    console.log('approved tenancy application already present:', approved.code)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
