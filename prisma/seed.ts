/**
 * Seed data.
 *
 * Built from ABN Homes' real portfolio as published on the website, so the
 * system is explorable the moment it starts rather than being an empty shell.
 *
 * Everything here is idempotent — run it as often as you like. Records are
 * matched on natural keys (slug, email, code) and updated rather than
 * duplicated.
 *
 *     npm run db:seed
 */

import { PrismaClient, type Currency, type Unit, type User } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

/** Development passwords. Change these before anyone real signs in. */
const DEV_PASSWORD = 'AbnHomes2026!'

const USD_TO_GHS = 12.5

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function monthsFromNow(months: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

const usd = (major: number) => Math.round(major * 100)
const ghs = (major: number) => Math.round(major * 100)

async function main() {
  console.log('Seeding ABN Homes platform...\n')

  // -------------------------------------------------------------------------
  // Settings and exchange rates
  // -------------------------------------------------------------------------
  await db.setting.upsert({
    where: { key: 'company' },
    update: {},
    create: {
      key: 'company',
      value: {
        name: 'ABN Homes Company Limited',
        phone: '+233541704048',
        email: 'hello@abnhomes.com.gh',
        address: '8 Asiko Street, Tantra Hill, Accra, Ghana',
        hours: 'Mon to Sat, 8:00 AM to 6:00 PM GMT',
      },
    },
  })

  // The reporting rate. Update it from the interface as the cedi moves —
  // historic entries keep the rate they were posted at.
  await db.fxRate.upsert({
    where: {
      from_to_asOf: { from: 'USD', to: 'GHS', asOf: new Date('2026-01-01T00:00:00Z') },
    },
    update: { rate: USD_TO_GHS },
    create: {
      from: 'USD',
      to: 'GHS',
      rate: USD_TO_GHS,
      asOf: new Date('2026-01-01T00:00:00Z'),
      source: 'seed',
    },
  })
  console.log(`  Exchange rate: 1 USD = ${USD_TO_GHS} GHS`)

  // -------------------------------------------------------------------------
  // Owners
  // -------------------------------------------------------------------------
  const abnOwner = await db.party.upsert({
    where: { id: 'party-abn-homes' },
    update: {},
    create: {
      id: 'party-abn-homes',
      type: 'COMPANY',
      name: 'ABN Homes Company Limited',
      email: 'hello@abnhomes.com.gh',
      phone: '+233541704048',
      address: '8 Asiko Street, Tantra Hill, Accra',
      isOwner: true,
    },
  })

  // A third-party owner, to exercise the managed-for-others path. ABN's own
  // buildings and a client's building run through identical code.
  const clientOwner = await db.party.upsert({
    where: { id: 'party-demo-owner' },
    update: {},
    create: {
      id: 'party-demo-owner',
      type: 'PERSON',
      name: 'Demo Client Owner',
      email: 'owner@example.com',
      phone: '+233201234567',
      address: 'Sakumono, Accra',
      isOwner: true,
      notes: 'Example third-party owner created by the seed. Safe to delete.',
    },
  })
  console.log('  Owners: ABN Homes, Demo Client Owner')

  // -------------------------------------------------------------------------
  // Properties
  // -------------------------------------------------------------------------
  const tantraHill = await db.property.upsert({
    where: { slug: 'tantra-hill' },
    update: {},
    create: {
      slug: 'tantra-hill',
      name: 'ABN Apartments, Tantra Hill',
      addressLine: '8 Asiko Street, Tantra Hill',
      city: 'Accra',
      latitude: 5.6407,
      longitude: -0.2735,
      description:
        'The home of the ABN Homes brand. Serviced apartments on one of Accra’s most connected streets, with an open rooftop bar, secure parking, backup power and 24/7 security.',
      amenities: [
        'Open rooftop bar',
        'Secure parking',
        'Backup power',
        '24/7 security',
        'Free WiFi',
        'Air conditioning',
      ],
      images: ['/images/abn-real/abn-ig-2-hd.jpg', '/images/abn-real/abn-ig-1-hd.jpg'],
      published: true,
      ownerPartyId: abnOwner.id,
    },
  })

  const achimota = await db.property.upsert({
    where: { slug: 'achimota-petroleum' },
    update: {},
    create: {
      slug: 'achimota-petroleum',
      name: 'Achimota Petroleum Estate Residence',
      addressLine: 'Achimota Petroleum Estate',
      city: 'Accra',
      description:
        'A four-bedroom ensuite residence with two halls and a spacious compound in a serene, established neighbourhood.',
      amenities: ['Spacious compound', 'Secure compound', 'Modern finishes', 'Family friendly'],
      images: ['/images/abn-real/abn-ig-5-hd.jpg'],
      published: true,
      ownerPartyId: abnOwner.id,
    },
  })

  const sakumono = await db.property.upsert({
    where: { slug: 'sakumono-residences' },
    update: {},
    create: {
      slug: 'sakumono-residences',
      name: 'Sakumono Residences',
      addressLine: 'Sakumono Estates',
      city: 'Tema',
      description:
        'Managed on behalf of a client owner. Long-let apartments billed monthly in cedis.',
      amenities: ['Gated community', 'Borehole water', 'Backup power'],
      images: ['/images/abn-real/abn-ig-10-hd.jpg'],
      published: false,
      ownerPartyId: clientOwner.id,
    },
  })
  console.log('  Properties: Tantra Hill, Achimota, Sakumono')

  // -------------------------------------------------------------------------
  // Management agreements — ABN's own carry a zero fee so that every
  // statement is produced by the same code path.
  // -------------------------------------------------------------------------
  for (const [property, ownerId, feeBp, note] of [
    [tantraHill, abnOwner.id, 0, 'ABN Homes owns this building outright.'],
    [achimota, abnOwner.id, 0, 'ABN Homes owns this building outright.'],
    [sakumono, clientOwner.id, 1500, 'Managed for a client owner at 15% of collected revenue.'],
  ] as const) {
    const existing = await db.managementAgreement.findFirst({
      where: { propertyId: property.id, active: true },
    })
    if (!existing) {
      await db.managementAgreement.create({
        data: {
          propertyId: property.id,
          ownerPartyId: ownerId,
          feeBasisPoints: feeBp,
          payoutSchedule: 'MONTHLY',
          deductExpenses: true,
          currency: 'GHS',
          startDate: new Date('2026-01-01T00:00:00Z'),
          terms: note,
        },
      })
    }
  }

  // -------------------------------------------------------------------------
  // Units
  // -------------------------------------------------------------------------
  const units = [
    {
      propertyId: tantraHill.id,
      code: 'PH',
      name: 'Tantra Hill Penthouse',
      type: 'PENTHOUSE' as const,
      lettingMode: 'SHORT_STAY' as const,
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 180,
      maxGuests: 4,
      baseNightlyMinor: usd(70),
      currency: 'USD' as Currency,
      description:
        'Two-bedroom penthouse with a luxury and elegant touch. 75-inch Smart TVs, an oven for your grills, and an open rooftop bar for BBQ parties.',
      features: [
        '75-inch Smart TV',
        'Open rooftop bar',
        'BBQ oven',
        'Free WiFi',
        'Private parking',
        'Air conditioning',
      ],
      images: ['/images/abn-real/abn-ig-2-hd.jpg', '/images/abn-real/abn-ig-7-hd.jpg'],
      published: true,
    },
    {
      propertyId: tantraHill.id,
      code: 'A1',
      name: 'Furnished One Bedroom',
      type: 'ONE_BED' as const,
      lettingMode: 'SHORT_STAY' as const,
      bedrooms: 1,
      bathrooms: 1,
      sizeSqm: 65,
      maxGuests: 2,
      baseNightlyMinor: usd(50),
      currency: 'USD' as Currency,
      description:
        'Stay with us and feel at home. A furnished one-bedroom apartment with a luxury feel, ideal for short stays and business trips.',
      features: ['Smart TV', 'Fully equipped kitchen', 'Free WiFi', 'Air conditioning'],
      images: ['/images/abn-real/abn-ig-8-hd.jpg'],
      published: true,
    },
    {
      propertyId: tantraHill.id,
      code: 'A2',
      name: 'Two Bedroom Apartment',
      type: 'TWO_BED' as const,
      lettingMode: 'BOTH' as const,
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 110,
      maxGuests: 4,
      baseNightlyMinor: usd(85),
      baseRentMinor: ghs(4500),
      currency: 'USD' as Currency,
      description:
        'Two-bedroom apartment available nightly or on a long let, depending on the season.',
      features: ['Smart TV', 'Balcony', 'Free WiFi', 'Air conditioning'],
      images: ['/images/abn-real/abn-ig-1-hd.jpg'],
      published: true,
    },
    {
      propertyId: achimota.id,
      code: 'MAIN',
      name: 'Achimota Four Bedroom Residence',
      type: 'FOUR_BED' as const,
      lettingMode: 'BOTH' as const,
      bedrooms: 4,
      bathrooms: 4,
      sizeSqm: 220,
      maxGuests: 8,
      baseNightlyMinor: usd(120),
      baseRentMinor: ghs(9000),
      currency: 'USD' as Currency,
      description:
        'Four bedrooms ensuite with two halls and a spacious compound in a serene environment.',
      features: ['4 bedrooms ensuite', '2 halls', 'Spacious compound', 'Glass staircase'],
      images: ['/images/abn-real/abn-ig-5-hd.jpg'],
      published: true,
    },
    {
      propertyId: sakumono.id,
      code: 'B1',
      name: 'Sakumono Block B, Flat 1',
      type: 'TWO_BED' as const,
      lettingMode: 'LONG_LET' as const,
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 95,
      maxGuests: 4,
      baseRentMinor: ghs(3200),
      currency: 'GHS' as Currency,
      description: 'Two-bedroom flat let on a yearly tenancy.',
      features: ['Borehole water', 'Backup power', 'Gated'],
      images: [],
      published: false,
    },
    {
      propertyId: sakumono.id,
      code: 'B2',
      name: 'Sakumono Block B, Flat 2',
      type: 'TWO_BED' as const,
      lettingMode: 'LONG_LET' as const,
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 95,
      maxGuests: 4,
      baseRentMinor: ghs(3200),
      currency: 'GHS' as Currency,
      description: 'Two-bedroom flat let on a yearly tenancy.',
      features: ['Borehole water', 'Backup power', 'Gated'],
      images: [],
      published: false,
    },
  ]

  const createdUnits: Unit[] = []
  for (const unit of units) {
    createdUnits.push(
      await db.unit.upsert({
        where: { propertyId_code: { propertyId: unit.propertyId, code: unit.code } },
        update: {},
        create: unit,
      })
    )
  }
  console.log(`  Units: ${createdUnits.length}`)

  // -------------------------------------------------------------------------
  // Rate plans — a standard rate plus a December peak, to prove that a stay
  // crossing the boundary picks up both.
  // -------------------------------------------------------------------------
  for (const unit of createdUnits.filter((u) => u.baseNightlyMinor)) {
    const existing = await db.ratePlan.findFirst({ where: { unitId: unit.id, name: 'Standard' } })
    if (!existing) {
      await db.ratePlan.create({
        data: {
          unitId: unit.id,
          name: 'Standard',
          currency: 'USD',
          nightlyMinor: unit.baseNightlyMinor!,
          weeklyMinor: Math.round(unit.baseNightlyMinor! * 6.2),
          cleaningFeeMinor: usd(15),
          minNights: 2,
          priority: 0,
        },
      })
      await db.ratePlan.create({
        data: {
          unitId: unit.id,
          name: 'December peak',
          currency: 'USD',
          nightlyMinor: Math.round(unit.baseNightlyMinor! * 1.4),
          cleaningFeeMinor: usd(15),
          minNights: 3,
          startDate: new Date('2026-12-15T00:00:00Z'),
          endDate: new Date('2027-01-06T00:00:00Z'),
          priority: 10,
        },
      })
    }
  }
  console.log('  Rate plans: standard and December peak')

  // -------------------------------------------------------------------------
  // Staff and portal accounts
  // -------------------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12)

  const staff = [
    { email: 'admin@abnhomes.com.gh', name: 'Frank Koomson', role: 'SUPER_ADMIN' as const },
    { email: 'manager@abnhomes.com.gh', name: 'Ama Boateng', role: 'PROPERTY_MANAGER' as const },
    { email: 'desk@abnhomes.com.gh', name: 'Kofi Mensah', role: 'FRONT_DESK' as const },
    { email: 'finance@abnhomes.com.gh', name: 'Akosua Darko', role: 'FINANCE' as const },
    { email: 'housekeeping@abnhomes.com.gh', name: 'Adjoa Nyarko', role: 'HOUSEKEEPING' as const },
  ]

  const staffUsers: User[] = []
  for (const person of staff) {
    const user = await db.user.upsert({
      where: { email: person.email },
      update: { role: person.role, name: person.name },
      create: { ...person, passwordHash, active: true },
    })
    staffUsers.push(user)

    // Scoped roles get explicit building access; admin and finance do not
    // need it, because their reach is portfolio-wide by policy.
    if (!['SUPER_ADMIN', 'FINANCE'].includes(person.role)) {
      for (const property of [tantraHill, achimota, sakumono]) {
        await db.userPropertyAccess.upsert({
          where: { userId_propertyId: { userId: user.id, propertyId: property.id } },
          update: {},
          create: { userId: user.id, propertyId: property.id },
        })
      }
    }
  }
  console.log(`  Staff accounts: ${staffUsers.length}`)

  // Owner login for the demo client owner.
  await db.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      phone: '+233201234567',
      name: 'Demo Client Owner',
      role: 'OWNER',
      passwordHash,
      partyId: clientOwner.id,
      active: true,
    },
  })

  // -------------------------------------------------------------------------
  // A tenant on a long let, paying a year in advance — the local case the
  // whole advance-rent design exists for.
  // -------------------------------------------------------------------------
  const tenant = await db.party.upsert({
    where: { id: 'party-demo-tenant' },
    update: {},
    create: {
      id: 'party-demo-tenant',
      type: 'PERSON',
      name: 'Yaa Asantewaa',
      phone: '+233244123456',
      email: 'tenant@example.com',
      ghanaCard: 'GHA-123456789-0',
      isTenant: true,
    },
  })

  await db.user.upsert({
    where: { email: 'tenant@example.com' },
    update: {},
    create: {
      email: 'tenant@example.com',
      phone: '+233244123456',
      name: 'Yaa Asantewaa',
      role: 'TENANT',
      passwordHash,
      partyId: tenant.id,
      active: true,
    },
  })

  const sakumonoUnit = createdUnits.find((u) => u.code === 'B1')!

  let lease = await db.lease.findFirst({ where: { unitId: sakumonoUnit.id } })
  if (!lease) {
    lease = await db.lease.create({
      data: {
        code: 'LSE-DEMO01',
        unitId: sakumonoUnit.id,
        tenantPartyId: tenant.id,
        status: 'ACTIVE',
        startDate: monthsFromNow(-4),
        endDate: monthsFromNow(8),
        cycle: 'MONTHLY',
        currency: 'GHS',
        rentMinor: ghs(3200),
        dueDay: 1,
        depositMinor: ghs(3200),
        advanceMonths: 12,
        escalationBasisPoints: 1000,
        graceDays: 5,
        lateFeeBasisPoints: 500,
        signedAt: monthsFromNow(-4),
      },
    })

    await db.recurringCharge.create({
      data: {
        leaseId: lease.id,
        type: 'SERVICE_CHARGE',
        label: 'Service charge — security and grounds',
        amountMinor: ghs(250),
        currency: 'GHS',
        cycle: 'MONTHLY',
        startDate: lease.startDate,
      },
    })

    await db.unit.update({ where: { id: sakumonoUnit.id }, data: { status: 'OCCUPIED' } })
  }
  console.log('  Lease: Sakumono B1, 12 months paid in advance')

  // -------------------------------------------------------------------------
  // Guests and reservations across past, present and future.
  // -------------------------------------------------------------------------
  const guest = await db.party.upsert({
    where: { id: 'party-demo-guest' },
    update: {},
    create: {
      id: 'party-demo-guest',
      type: 'PERSON',
      name: 'Michael Osei',
      phone: '+233209876543',
      email: 'guest@example.com',
      nationality: 'United Kingdom',
      isGuest: true,
    },
  })

  const penthouse = createdUnits.find((u) => u.code === 'PH')!
  const oneBed = createdUnits.find((u) => u.code === 'A1')!

  const reservations = [
    {
      code: 'ABN-SEED01',
      unitId: penthouse.id,
      checkIn: daysFromNow(-10),
      checkOut: daysFromNow(-6),
      status: 'CHECKED_OUT' as const,
      nights: 4,
      rate: usd(70),
    },
    {
      code: 'ABN-SEED02',
      unitId: oneBed.id,
      checkIn: daysFromNow(-2),
      checkOut: daysFromNow(3),
      status: 'CHECKED_IN' as const,
      nights: 5,
      rate: usd(50),
    },
    {
      code: 'ABN-SEED03',
      unitId: penthouse.id,
      checkIn: daysFromNow(6),
      checkOut: daysFromNow(11),
      status: 'CONFIRMED' as const,
      nights: 5,
      rate: usd(70),
    },
  ]

  for (const r of reservations) {
    const existing = await db.reservation.findUnique({ where: { code: r.code } })
    if (existing) continue

    await db.reservation.create({
      data: {
        code: r.code,
        unitId: r.unitId,
        guestPartyId: guest.id,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights: r.nights,
        adults: 2,
        status: r.status,
        source: 'DIRECT',
        currency: 'USD',
        nightlyRateMinor: r.rate,
        cleaningFeeMinor: usd(15),
        totalMinor: r.rate * r.nights + usd(15),
        depositMinor: r.rate,
        ...(r.status === 'CHECKED_IN' ? { checkedInAt: r.checkIn } : {}),
        ...(r.status === 'CHECKED_OUT'
          ? { checkedInAt: r.checkIn, checkedOutAt: r.checkOut }
          : {}),
      },
    })
  }
  console.log(`  Reservations: ${reservations.length}`)

  await db.unit.update({ where: { id: oneBed.id }, data: { status: 'OCCUPIED' } })

  // -------------------------------------------------------------------------
  // Housekeeping and a maintenance ticket.
  // -------------------------------------------------------------------------
  const turnover = await db.housekeepingTask.findFirst({ where: { unitId: penthouse.id } })
  if (!turnover) {
    await db.housekeepingTask.create({
      data: {
        unitId: penthouse.id,
        type: 'TURNOVER',
        status: 'PENDING',
        dueAt: daysFromNow(0),
        checklist: [
          { item: 'Strip and remake beds', done: false },
          { item: 'Clean bathrooms', done: false },
          { item: 'Restock water and toiletries', done: false },
          { item: 'Check the rooftop bar area', done: false },
          { item: 'Photograph the finished unit', done: false },
        ],
      },
    })
  }

  const vendor = await db.party.upsert({
    where: { id: 'party-demo-vendor' },
    update: {},
    create: {
      id: 'party-demo-vendor',
      type: 'COMPANY',
      name: 'Accra Cooling Services',
      phone: '+233277654321',
      isVendor: true,
      vendorTrade: 'Air conditioning',
    },
  })

  const existingTicket = await db.ticket.findUnique({ where: { code: 'TKT-SEED1' } })
  if (!existingTicket) {
    await db.ticket.create({
      data: {
        code: 'TKT-SEED1',
        propertyId: tantraHill.id,
        unitId: oneBed.id,
        title: 'Bedroom air conditioner not cooling',
        description:
          'Guest reports the bedroom unit runs but does not cool. Living room unit is fine.',
        category: 'AIR_CONDITIONING',
        priority: 'HIGH',
        status: 'ASSIGNED',
        reporterPartyId: guest.id,
        vendorPartyId: vendor.id,
        slaDueAt: daysFromNow(1),
      },
    })
  }

  console.log('  Housekeeping task and maintenance ticket created')

  // -------------------------------------------------------------------------
  console.log('\nDone.\n')
  console.log('Sign in at /signin with any of these:')
  for (const person of staff) {
    console.log(`  ${person.email.padEnd(34)} ${person.role}`)
  }
  console.log(`  owner@example.com                  OWNER`)
  console.log(`  tenant@example.com                 TENANT`)
  console.log(`\n  Password for all: ${DEV_PASSWORD}`)
  console.log('\n  Change these before the system holds anything real.\n')
  console.log('Next: run `npm run db:constraints` to install the database guarantees.\n')
}

main()
  .catch((error) => {
    console.error('\nSeed failed:\n', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
