/**
 * One-time backfill: give every unit without a stored slug the slug the
 * marketplace cards already compute for it — `${property.slug}-${code}`,
 * lowercased — so `/stays/<slug>` links resolve.
 *
 * Idempotent: only touches rows where slug IS NULL.
 *
 *    DATABASE_URL=... npx tsx scripts/backfill_unit_slugs.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const units = await db.unit.findMany({
    where: { slug: null },
    select: { id: true, code: true, slug: true, property: { select: { slug: true } } },
  })

  for (const unit of units) {
    const slug = `${unit.property.slug}-${unit.code.toLowerCase()}`
    await db.unit.update({ where: { id: unit.id }, data: { slug } })
    console.log(`unit ${unit.code}: slug -> ${slug}`)
  }
  console.log(`done, ${units.length} unit(s) updated`)
  await db.$disconnect()
}
main()
