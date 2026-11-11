/**
 * Marketplace enrichment seed.
 *
 * Idempotent: safe to run repeatedly. Fills in the guest-facing content the
 * booking engine needs to look world class — descriptions, amenities, house
 * rules, safety disclosures, sleeping arrangements, slugs — plus demo
 * add-ons, coupons, verified reviews, the asset register and preventive
 * maintenance schedules.
 *
 * Run: npm run db:seed:marketplace
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const IMG = (n: number) => `/images/abn-real/abn-ig-${n}-hd.jpg`
const TANTRA_IMGS = [IMG(2), IMG(7), IMG(3), IMG(1), '/images/properties/tantra4-atrium.jpg', '/images/properties/tantra4-bedroom.jpg', '/images/properties/tantra4-compound.jpg', IMG(6)]
const ACHIMOTA_IMGS = [IMG(5), IMG(8), IMG(9), IMG(10), '/images/properties/semi3-facade.jpg', '/images/properties/semi3-lounge.jpg', '/images/properties/semi3-room1.jpg']
const TOUR = ['/images/tour-living.jpg', '/images/tour-kitchen.jpg', '/images/tour-suite.jpg', '/images/tour-exterior.jpg']

const HOUSE_RULES = [
  'Check-in from 15:00, checkout by 11:00',
  'No smoking indoors — balcony is fine',
  'No parties or events',
  'Quiet hours 22:00–06:00 (the neighbours say thank you)',
  'Registered guests only — visitors until 20:00',
  'Generator switch-over: lights and sockets stay live; AC pauses for 2 minutes',
]

const SAFETY_BASE = {
  smokeAlarm: true,
  coAlarm: true,
  fireExtinguisher: true,
  firstAidKit: true,
  securityCameraNote: 'CCTV covers the compound gate and car park only — never inside the homes.',
}

async function main() {
  console.log('—— marketplace enrichment ———')

  // ---------------------------------------------------------------- properties
  await db.property.update({
    where: { slug: 'tantra-hill' },
    data: {
      neighbourhood: 'Tantra Hill',
      aboutArea:
        'Tantra Hill sits above the Ring Road bustle: 10 minutes to Osu, 20 to the airport outside peak hours. The compound is gated with 24/7 security, and the rooftop terrace catches the evening breeze. supermarkets (MaxMart, Palace), pharmacies and some of Accra\'s best kitchens are all within a short Bolt ride.',
      published: true,
    },
  })
  await db.property.update({
    where: { slug: 'achimota-petroleum' },
    data: {
      neighbourhood: 'Achimota',
      aboutArea:
        'A calm residential pocket by Achimota Forest — green, quiet, and remarkably central. Universities, hospitals (37 Military, Achimota Hospital) and the Achimota Retail Centre are minutes away, and the N6 puts the airport under half an hour in honest traffic.',
      published: true,
    },
  })

  // ---------------------------------------------------------------- units
  await db.unit.update({
    where: { propertyId_code: { propertyId: (await bySlug('tantra-hill')).id, code: 'PH' } },
    data: {
      published: true,
      slug: 'tantra-hill-penthouse',
      description:
        'The whole top floor to yourself: two en-suite bedrooms, an open-plan living space with a 75-inch Smart TV, a kitchen you can actually cook in, and a private rooftop terrace for sundowners. Fully serviced — housekeeping, laundry, backup power and 24/7 security are part of the stay, not extras.',
      features: [
        'Air conditioning throughout',
        '75-inch Smart TV + Netflix',
        'Fast Wi-Fi (verified 40 Mbps)',
        'Fully equipped kitchen',
        'Washing machine + dryer',
        'Backup generator',
        'Inverter backup',
        '10,000 L water storage',
        'Rooftop terrace',
        'Free parking',
        '24/7 security & CCTV',
        'Daily housekeeping (long stays)',
      ],
      houseRules: HOUSE_RULES,
      safety: { ...SAFETY_BASE, hazardNote: 'Rooftop terrace has a low parapet — supervise children.' },
      sleeping: [
        { room: 'Master bedroom', bed: 'King', count: 1 },
        { room: 'Second bedroom', bed: 'Queen', count: 1 },
        { room: 'Living room', bed: 'Sofa bed', count: 1 },
      ],
      wifiName: 'ABN-Penthouse',
      wifiPassword: 'staywithabn',
      wifiSpeedMbps: 40,
      checkInFrom: '15:00',
      checkOutUntil: '11:00',
      selfCheckIn: false,
      instantBook: true,
      licenseNumber: 'GTA-ACC-2026-0114',
      backupPower: 'generator',
      generatorKva: 15,
      waterStorageLitres: 10_000,
      securityNotes: 'Gated compound, 24-hour guard, CCTV at gate and car park, burglar-proof windows.',
      deskSpace: true,
      transitNotes: 'Bolt/Uber pick-up at the gate, 2 min to Ring Road, 20 min to Kotoka Airport off-peak.',
      images: TANTRA_IMGS,
    },
  })

  await db.unit.update({
    where: { propertyId_code: { propertyId: (await bySlug('tantra-hill')).id, code: 'A1' } },
    data: {
      published: true,
      slug: 'tantra-hill-a1',
      description:
        'A calm, light-filled one-bedroom apartment on the first floor: proper kitchen, workspace with a view of the trees, and the same serviced standard as the penthouse. Ideal for solo travellers and remote workers who want Accra to feel easy.',
      features: [
        'Air conditioning',
        'Smart TV',
        'Fast Wi-Fi (verified 40 Mbps)',
        'Dedicated workspace',
        'Fully equipped kitchen',
        'Washing machine',
        'Backup generator',
        'Inverter backup',
        '10,000 L water storage',
        'Free parking',
        '24/7 security & CCTV',
      ],
      houseRules: HOUSE_RULES,
      safety: SAFETY_BASE,
      sleeping: [{ room: 'Bedroom', bed: 'Queen', count: 1 }],
      wifiName: 'ABN-A1',
      wifiPassword: 'staywithabn',
      wifiSpeedMbps: 40,
      checkInFrom: '15:00',
      checkOutUntil: '11:00',
      selfCheckIn: true,
      instantBook: true,
      licenseNumber: 'GTA-ACC-2026-0115',
      backupPower: 'generator',
      generatorKva: 15,
      waterStorageLitres: 10_000,
      securityNotes: 'Gated compound, 24-hour guard, CCTV at gate and car park.',
      deskSpace: true,
      transitNotes: 'Bolt/Uber at the gate; MaxMart Tantra 4 min by car.',
      images: [IMG(8), IMG(4), ...TOUR, IMG(11)],
    },
  })

  await db.unit.update({
    where: { propertyId_code: { propertyId: (await bySlug('tantra-hill')).id, code: 'A2' } },
    data: {
      published: true,
      slug: 'tantra-hill-a2',
      description:
        'Ground-floor one-bedroom with its own entrance off the courtyard — the easiest arrival in the building. Same serviced standard: strong Wi-Fi, backup power, water storage, and a kitchen that has everything except the groceries.',
      features: [
        'Air conditioning',
        'Smart TV',
        'Fast Wi-Fi (verified 40 Mbps)',
        'Fully equipped kitchen',
        'Washing machine',
        'Backup generator',
        'Inverter backup',
        '10,000 L water storage',
        'Step-free entrance',
        'Free parking',
        '24/7 security & CCTV',
      ],
      houseRules: HOUSE_RULES,
      safety: SAFETY_BASE,
      sleeping: [{ room: 'Bedroom', bed: 'Queen', count: 1 }],
      wifiName: 'ABN-A2',
      wifiPassword: 'staywithabn',
      wifiSpeedMbps: 40,
      checkInFrom: '15:00',
      checkOutUntil: '11:00',
      selfCheckIn: true,
      instantBook: true,
      licenseNumber: 'GTA-ACC-2026-0116',
      backupPower: 'generator',
      generatorKva: 15,
      waterStorageLitres: 10_000,
      securityNotes: 'Gated compound, 24-hour guard, CCTV at gate and car park.',
      deskSpace: false,
      transitNotes: 'Bolt/Uber at the gate; step-free from car park to door.',
      images: [IMG(1), IMG(12), ...TOUR],
    },
  })

  await db.unit.update({
    where: { propertyId_code: { propertyId: (await bySlug('achimota-petroleum')).id, code: 'MAIN' } },
    data: {
      published: true,
      slug: 'achimota-grand-four-bed',
      description:
        'A genuine family home: four en-suite bedrooms around a generous living and dining space, a big kitchen, and a walled garden. Built for reunions, relocations and teams who want to be together without being on top of each other.',
      features: [
        'Air conditioning throughout',
        '4 en-suite bedrooms',
        'Smart TV + sound bar',
        'Fast Wi-Fi (verified 60 Mbps)',
        'Fully equipped kitchen',
        'Washing machine + dryer',
        'Backup generator',
        '15,000 L water storage',
        'Walled garden',
        'Free parking (3 cars)',
        '24/7 security & CCTV',
      ],
      houseRules: HOUSE_RULES,
      safety: { ...SAFETY_BASE, hazardNote: 'Garden steps — mind the change in level after dark.' },
      sleeping: [
        { room: 'Master bedroom (downstairs)', bed: 'King', count: 1 },
        { room: 'Bedroom 2', bed: 'Queen', count: 1 },
        { room: 'Bedroom 3', bed: 'Queen', count: 1 },
        { room: 'Bedroom 4', bed: 'Twin beds', count: 2 },
      ],
      wifiName: 'ABN-Achimota',
      wifiPassword: 'staywithabn',
      wifiSpeedMbps: 60,
      checkInFrom: '15:00',
      checkOutUntil: '11:00',
      selfCheckIn: false,
      instantBook: true,
      licenseNumber: 'GTA-ACC-2026-0117',
      backupPower: 'generator',
      generatorKva: 20,
      waterStorageLitres: 15_000,
      securityNotes: 'Walled compound, 24-hour guard house, CCTV coverage, electric fence.',
      deskSpace: true,
      transitNotes: 'Off the N6 — 5 min to Achimota Retail Centre, 25 min to the airport.',
      images: ACHIMOTA_IMGS,
    },
  })

  // ---------------------------------------------------------------- add-ons
  const addOns = [
    { name: 'Airport pickup (Kotoka)', description: 'Your driver meets you at arrivals with a name board, water and cold towels. Up to 4 passengers.', icon: 'plane', priceMinor: 6_000, per: 'PER_STAY' as const, maxQty: 2, sortOrder: 1 },
    { name: 'Early check-in (from 10:00)', description: 'Subject to same-day availability — we confirm by WhatsApp the evening before.', icon: 'clock', priceMinor: 2_500, per: 'PER_STAY' as const, maxQty: 1, sortOrder: 2 },
    { name: 'Late check-out (until 18:00)', description: 'Keep the apartment until 6pm on departure day. Subject to availability.', icon: 'moon', priceMinor: 3_500, per: 'PER_STAY' as const, maxQty: 1, sortOrder: 3 },
    { name: 'Baby cot + high chair', description: 'Cot with fresh linen, high chair and a safety gate where useful.', icon: 'baby', priceMinor: 1_500, per: 'PER_STAY' as const, maxQty: 2, sortOrder: 4 },
    { name: 'Mid-stay clean & linen change', description: 'Full changeover: sheets, towels, floors and bathrooms.', icon: 'sparkles', priceMinor: 2_000, per: 'PER_STAY' as const, maxQty: 3, sortOrder: 5 },
    { name: 'Grocery pre-stock', description: 'Tell us your list (or pick the breakfast box) and it will be in the fridge when you arrive. You approve the receipt.', icon: 'shopping', priceMinor: 5_000, per: 'PER_STAY' as const, maxQty: 1, sortOrder: 6 },
  ]
  for (const a of addOns) {
    const existing = await db.addOn.findFirst({ where: { name: a.name } })
    if (existing) {
      await db.addOn.update({ where: { id: existing.id }, data: { ...a, currency: 'USD', active: true } })
    } else {
      await db.addOn.create({ data: { ...a, currency: 'USD', active: true } })
    }
  }
  console.log(`add-ons ensured (${addOns.length})`)

  // ---------------------------------------------------------------- coupons
  const coupons = [
    {
      code: 'WELCOME10',
      kind: 'PERCENT' as const,
      value: 1000,
      currency: 'USD' as const,
      minSpendMinor: 20_000,
      maxDiscountMinor: 5_000,
      firstBookingOnly: true,
      note: 'First direct booking — 10% off, capped at $50',
    },
    {
      code: 'DETTYDEC',
      kind: 'FIXED' as const,
      value: 5_000,
      currency: 'USD' as const,
      minSpendMinor: 50_000,
      maxRedemptions: 100,
      note: 'December campaign — $50 off stays of $500+',
    },
    {
      code: 'MOMOFEST',
      kind: 'PERCENT' as const,
      value: 500,
      currency: 'GHS' as const,
      minSpendMinor: 200_000,
      maxDiscountMinor: 30_000,
      note: 'Mobile money promo — 5% off in cedis, capped at GHS 300',
    },
  ]
  for (const c of coupons) {
    await db.coupon.upsert({ where: { code: c.code }, create: c, update: c })
  }
  console.log(`coupons ensured (${coupons.length})`)

  // ---------------------------------------------------------------- reviews
  const ph = await db.unit.findUnique({
    where: { propertyId_code: { propertyId: (await bySlug('tantra-hill')).id, code: 'PH' } },
    include: { reservations: true },
  })
  const guest = await db.party.findFirst({ where: { email: 'guest@example.com' } })
  const staff = await db.user.findUnique({ where: { email: 'manager@abnhomes.com.gh' } })

  if (ph && guest && staff) {
    // A completed stay per review, in the past, non-overlapping.
    const pastStays = [
      { code: 'ABN-SEED01', end: daysAgo(40), nights: 5, rating: 5, body: 'The penthouse is even better than the photos. Backup power meant the December lights-out did not touch us, the rooftop at sunset is unreal, and the team answered every WhatsApp within minutes. The airport pickup driver was waiting with cold water. Already booked again.', name: 'Michael Osei' },
      { code: 'ABN-SEED-R2', end: daysAgo(95), nights: 8, rating: 5, body: 'We stayed for a month of remote work. The Wi-Fi is genuinely fast (I run video calls all day), the desk is comfortable, and housekeeping kept everything immaculate. The generator kicks in so fast you barely notice the power cuts.', name: 'Michael Osei' },
      { code: 'ABN-SEED-R3', end: daysAgo(150), nights: 3, rating: 4, body: 'Lovely place and wonderful staff. Only note is that the street can be noisy in the early morning — bring earplugs if you are a light sleeper. Everything else was superb: clean, safe, and the water pressure never dropped once.', name: 'Michael Osei' },
    ]

    for (const stay of pastStays) {
      const start = new Date(stay.end)
      start.setDate(start.getDate() - stay.nights)
      const reservation = await db.reservation.upsert({
        where: { code: stay.code },
        create: {
          code: stay.code,
          unitId: ph.id,
          guestPartyId: guest.id,
          checkIn: start,
          checkOut: stay.end,
          nights: stay.nights,
          adults: 2,
          status: 'CHECKED_OUT',
          source: 'WEBSITE',
          currency: 'USD',
          nightlyRateMinor: 14_500,
          totalMinor: 14_500 * stay.nights + 1_500,
          checkedInAt: start,
          checkedOutAt: stay.end,
          portalCode: `PIN-${stay.code.slice(-6)}`,
        },
        update: { status: 'CHECKED_OUT', checkedOutAt: stay.end },
      })

      const windowEnd = new Date(stay.end)
      windowEnd.setDate(windowEnd.getDate() + 14)
      await db.review.upsert({
        where: { reservationId_authorRole: { reservationId: reservation.id, authorRole: 'GUEST' } },
        create: {
          reservationId: reservation.id,
          unitId: ph.id,
          authorRole: 'GUEST',
          authorPartyId: guest.id,
          rating: stay.rating,
          subRatings: { cleanliness: 5, accuracy: 5, checkIn: 5, communication: 5, location: 4, value: 4 },
          body: stay.body,
          status: 'PUBLISHED',
          publishedAt: stay.end,
          windowEndsAt: windowEnd,
          hostResponse:
            stay.code === 'ABN-SEED-R3'
              ? 'Thank you for the honest note about morning noise — we have since added blackout curtains and heavier glazing to the street-facing bedrooms.'
              : null,
          hostResponseById: stay.code === 'ABN-SEED-R3' ? staff.id : null,
          hostResponseAt: stay.code === 'ABN-SEED-R3' ? stay.end : null,
        },
        update: { status: 'PUBLISHED', publishedAt: stay.end },
      })
    }
    console.log('reviews ensured (3)')
  }

  // ---------------------------------------------------------------- assets
  const tantra = await bySlug('tantra-hill')
  const achimota = await bySlug('achimota-petroleum')
  const assets = [
    { propertyId: tantra.id, name: 'Standby generator', category: 'Power', brand: 'Perkins', serial: 'PRK-15KVA-2231', nextServiceAt: daysAgo(-20), notes: '15 kVA, services monthly', valueMinor: 850_000_00, currency: 'GHS' as const },
    { propertyId: tantra.id, name: 'Water pump', category: 'Plumbing', brand: 'Grundfos', serial: 'GRF-1022', notes: 'Compound supply pump', valueMinor: 120_000_00, currency: 'GHS' as const },
    { propertyId: achimota.id, name: 'Split AC units (×5)', category: 'Cooling', brand: 'Daikin', serial: 'DK-BATCH-77', nextServiceAt: daysAgo(-45), notes: 'Serviced quarterly', valueMinor: 620_000_00, currency: 'GHS' as const },
  ]
  for (const a of assets) {
    const existing = await db.asset.findFirst({ where: { propertyId: a.propertyId, name: a.name } })
    if (!existing) await db.asset.create({ data: a })
  }
  console.log(`assets ensured (${assets.length})`)

  // ---------------------------------------------------------------- preventive maintenance
  const schedules = [
    { propertyId: tantra.id, name: 'Generator service', description: 'Oil, filters, load test. Log the readings.', category: 'POWER_BACKUP' as const, priority: 'NORMAL' as const, intervalDays: 30, leadDays: 5, nextDueAt: daysAgo(-12) },
    { propertyId: tantra.id, name: 'Water tank cleaning', description: 'Drain, scrub, chlorinate, refill; photograph before/after.', category: 'WATER_SUPPLY' as const, priority: 'HIGH' as const, intervalDays: 90, leadDays: 7, nextDueAt: daysAgo(-30) },
    { propertyId: achimota.id, name: 'AC servicing round', description: 'All 5 splits: filters, gas pressure, drain lines.', category: 'AIR_CONDITIONING' as const, priority: 'NORMAL' as const, intervalDays: 90, leadDays: 10, nextDueAt: daysAgo(-40) },
    { propertyId: achimota.id, name: 'Pest control', description: 'Perimeter + garden, pet-safe products only.', category: 'PEST' as const, priority: 'LOW' as const, intervalDays: 90, leadDays: 7, nextDueAt: daysAgo(-60) },
  ]
  for (const s of schedules) {
    const existing = await db.preventiveMaintenance.findFirst({ where: { propertyId: s.propertyId, name: s.name } })
    if (!existing) await db.preventiveMaintenance.create({ data: s })
  }
  console.log(`preventive schedules ensured (${schedules.length})`)

  console.log('—— marketplace seed complete ———')
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(12, 0, 0, 0)
  return d
}

async function bySlug(slug: string) {
  return db.property.findUniqueOrThrow({ where: { slug } })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
