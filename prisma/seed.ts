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

/**
 * Demonstration data is opt-in. A live database should contain the real
 * building and nothing invented: the ledger is append-only, so a made-up
 * booking cannot be quietly removed once it is in.
 */
const WITH_DEMO = process.argv.includes('--demo') || process.env.SEED_DEMO === '1'

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

  // A placeholder third-party owner, so the managed-for-others path stays
  // exercised and the owner portal has something to sign into. Named
  // unmistakably as a placeholder: nobody should ever mistake this for a real
  // client. Replace it with the actual owner's details — same record, so
  // nothing downstream has to be rebuilt — when ABN takes on a real one.
  const clientOwner = await db.party.upsert({
    where: { id: 'party-demo-owner' },
    update: {},
    create: {
      id: 'party-demo-owner',
      type: 'PERSON',
      name: 'Placeholder Owner — details pending',
      email: 'owner@example.com',
      phone: '+233201234567',
      address: 'Sakumono, Accra',
      isOwner: true,
      notes:
        'PLACEHOLDER. Not a real client. Overwrite this record with the real owner when one is signed — do not create a second one, or the Sakumono statements will split across two parties.',
    },
  })
  console.log('  Owners: ABN Homes, placeholder owner (Sakumono)')

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
      // Unpublished until its rooms, rates and photographs are confirmed.
      // The record stays so the detail can be filled in rather than recreated.
      published: false,
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
      description: 'Long-let apartments billed monthly in cedis.',
      amenities: ['Gated community', 'Borehole water', 'Backup power'],
      images: ['/images/abn-real/abn-ig-10-hd.jpg'],
      // Unpublished until its rooms, rates and photographs are confirmed.
      published: false,
      ownerPartyId: clientOwner.id,
    },
  })
  console.log('  Properties: Tantra Hill (live), Achimota + Sakumono (details pending)')

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
  // --- Tantra Hill, 8 Asiko Street — the live building ----------------------
  //
  // Six lettable rooms and the rooftop. Each room is run independently: its own
  // calendar, its own manager, its own revenue. Nightly rates follow the prices
  // ABN already publishes — $50 for a one-bedroom, $70 for the penthouse. The
  // studio rate is an estimate and should be confirmed before go-live.
  //
  // Photography: these are the existing building shots. Replace the `images`
  // array per room as the individual room photographs come in.
  const ROOM_PHOTOS = [
    '/images/abn-real/abn-ig-8-hd.jpg',
    '/images/abn-real/abn-ig-1-hd.jpg',
    '/images/abn-real/abn-ig-4-hd.jpg',
    '/images/abn-real/abn-ig-6-hd.jpg',
  ]

  const oneBedroom = (n: number, photo: string) => ({
    propertyId: tantraHill.id,
    code: String(n),
    name: `Room ${n}`,
    type: 'ONE_BED' as const,
    lettingMode: 'BOTH' as const,
    sortOrder: n,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqm: 65,
    maxGuests: 2,
    baseNightlyMinor: usd(50),
    baseRentMinor: ghs(3800),
    currency: 'USD' as Currency,
    description:
      'A furnished one-bedroom apartment with a luxury feel — Smart TV, fully equipped kitchen, air conditioning. Suits a short stay, a business trip or a longer let.',
    features: [
      'Smart TV',
      'Fully equipped kitchen',
      'Air conditioning',
      'Free WiFi',
      'Backup power',
      'Secure parking',
      'Rooftop access',
    ],
    images: [photo],
    published: true,
  })

  const units = [
    oneBedroom(2, ROOM_PHOTOS[0]),
    oneBedroom(3, ROOM_PHOTOS[1]),
    {
      propertyId: tantraHill.id,
      code: '4',
      name: 'Room 4',
      type: 'STUDIO' as const,
      lettingMode: 'BOTH' as const,
      sortOrder: 4,
      bedrooms: 1,
      bathrooms: 1,
      sizeSqm: 42,
      maxGuests: 2,
      baseNightlyMinor: usd(40),
      baseRentMinor: ghs(2800),
      currency: 'USD' as Currency,
      description:
        'A self-contained studio — open living and sleeping area with its own kitchenette and bathroom. The most economical room in the building.',
      features: [
        'Smart TV',
        'Kitchenette',
        'Air conditioning',
        'Free WiFi',
        'Backup power',
        'Rooftop access',
      ],
      images: [ROOM_PHOTOS[2]],
      published: true,
    },
    oneBedroom(5, ROOM_PHOTOS[3]),
    oneBedroom(6, ROOM_PHOTOS[0]),
    {
      propertyId: tantraHill.id,
      code: '7',
      name: 'Room 7 — Penthouse',
      type: 'PENTHOUSE' as const,
      lettingMode: 'BOTH' as const,
      sortOrder: 7,
      bedrooms: 2,
      bathrooms: 2,
      sizeSqm: 180,
      maxGuests: 4,
      baseNightlyMinor: usd(70),
      baseRentMinor: ghs(6500),
      currency: 'USD' as Currency,
      description:
        'The two-bedroom penthouse, with a luxury and elegant touch. 75-inch Smart TVs, an oven for your grills, and direct access to the open rooftop bar.',
      features: [
        '75-inch Smart TV',
        'Two bedrooms',
        'BBQ oven',
        'Direct rooftop access',
        'Air conditioning',
        'Free WiFi',
        'Secure parking',
      ],
      images: ['/images/abn-real/abn-ig-2-hd.jpg', '/images/abn-real/abn-ig-7-hd.jpg'],
      published: true,
    },
    {
      // Shared space, not a room. It appears on the board so housekeeping and
      // maintenance can see it, but it is never bookable and earns nothing
      // directly, so every occupancy and revenue figure leaves it out.
      propertyId: tantraHill.id,
      code: 'ROOFTOP',
      name: 'Rooftop',
      type: 'COMMERCIAL' as const,
      lettingMode: 'SHORT_STAY' as const,
      isAmenity: true,
      sortOrder: 8,
      bedrooms: 0,
      bathrooms: 0,
      maxGuests: 20,
      currency: 'USD' as Currency,
      description:
        'The open rooftop bar and BBQ terrace, shared by every guest in the building.',
      features: ['Open bar', 'BBQ grill', 'Seating', 'City views'],
      images: ['/images/abn-real/abn-ig-11-hd.jpg'],
      published: false,
    },
    // --- Other ABN properties — real, but details still to come -------------
    // Kept in place so they can be filled in rather than recreated. Unpublished
    // until their rooms, rates and photographs are confirmed.
    {
      propertyId: achimota.id,
      code: 'MAIN',
      name: 'Achimota Four Bedroom Residence',
      type: 'FOUR_BED' as const,
      lettingMode: 'BOTH' as const,
      sortOrder: 1,
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
      published: false,
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

  // ===========================================================================
  // DEMONSTRATION DATA — everything below this line is invented
  // ===========================================================================
  //
  // A sample tenant, a sample guest, three bookings, a maintenance ticket.
  // Useful for showing the system to a client; wrong in a live database, where
  // a made-up booking sits in the same reports as real ones and the ledger is
  // append-only, so it cannot be quietly removed later.
  //
  //   npm run db:seed        the real building, nothing invented
  //   npm run db:seed:demo   the above, plus everything below
  //
  if (!WITH_DEMO) {
    console.log('\nDone — real portfolio only, no demonstration data.\n')
    printAccounts()
    return
  }

  console.log('\n  Adding demonstration data…')

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

  const penthouse = createdUnits.find((u) => u.code === '7')!
  const oneBed = createdUnits.find((u) => u.code === '2')!

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

  console.log('\nDone — including demonstration data.\n')
  printAccounts(true)
}

function printAccounts(withDemo = false) {
  console.log('Sign in at /signin with any of these:')
  console.log(`  admin@abnhomes.com.gh              SUPER_ADMIN`)
  console.log(`  manager@abnhomes.com.gh            PROPERTY_MANAGER`)
  console.log(`  desk@abnhomes.com.gh               FRONT_DESK`)
  console.log(`  finance@abnhomes.com.gh            FINANCE`)
  console.log(`  housekeeping@abnhomes.com.gh       HOUSEKEEPING`)
  console.log(`  owner@example.com                  OWNER       (placeholder)`)
  if (withDemo) {
    console.log(`  tenant@example.com                 TENANT      (demonstration)`)
  }
  console.log(`\n  Password for all: ${DEV_PASSWORD}`)
  console.log('\n  CHANGE THESE before the system holds anything real.\n')
  console.log('Then run `npm run db:constraints` to install the database guarantees.\n')
}

main()
  .catch((error) => {
    console.error('\nSeed failed:\n', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
