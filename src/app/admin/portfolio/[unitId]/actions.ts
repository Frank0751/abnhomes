'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { importFeed } from '@/lib/short-stay/ical'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

async function assertUnitAccess(unitId: string) {
  const actor = await requireActor()
  const unit = await db.unit.findUniqueOrThrow({
    where: { id: unitId },
    select: { propertyId: true },
  })
  assertCanOnProperty(actor, 'calendar:manage', unit.propertyId)
  return actor
}

export async function addFeedAction(unitId: string, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertUnitAccess(unitId)

    const label = String(formData.get('label') ?? '').trim()
    const url = String(formData.get('url') ?? '').trim()

    if (!label) return { ok: false, error: 'Name the feed, e.g. Airbnb.' }
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, error: 'That does not look like a calendar URL.' }
    }

    const feed = await db.icalFeed.create({
      data: { unitId, label, url },
    })

    // Pull it straight away, so a bad URL is caught now rather than at 3am.
    const result = await importFeed(feed.id)

    await logAudit({
      actor,
      action: 'ical.feed_added',
      entityType: 'IcalFeed',
      entityId: feed.id,
      after: { label, url },
    })

    revalidatePath(`/admin/portfolio/${unitId}`)
    revalidatePath('/admin/calendar')

    return result.ok
      ? { ok: true, message: `${label} connected — ${result.imported} blocked period(s) imported.` }
      : { ok: false, error: `Feed saved, but the first sync failed: ${result.error}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not add the feed.' }
  }
}

export async function syncFeedAction(feedId: string): Promise<ActionResult> {
  try {
    const feed = await db.icalFeed.findUniqueOrThrow({ where: { id: feedId } })
    await assertUnitAccess(feed.unitId)

    const result = await importFeed(feedId)

    revalidatePath(`/admin/portfolio/${feed.unitId}`)
    revalidatePath('/admin/calendar')

    return result.ok
      ? { ok: true, message: `${result.imported} blocked period(s) imported from ${feed.label}.` }
      : { ok: false, error: result.error ?? 'The feed could not be read.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Sync failed.' }
  }
}

export async function removeFeedAction(feedId: string): Promise<ActionResult> {
  try {
    const feed = await db.icalFeed.findUniqueOrThrow({ where: { id: feedId } })
    const actor = await assertUnitAccess(feed.unitId)

    // Its imported blocks go with it — leaving them would block dates forever
    // with nothing left to explain why.
    await db.icalFeed.delete({ where: { id: feedId } })

    await logAudit({
      actor,
      action: 'ical.feed_removed',
      entityType: 'IcalFeed',
      entityId: feedId,
      before: { label: feed.label, url: feed.url },
    })

    revalidatePath(`/admin/portfolio/${feed.unitId}`)
    revalidatePath('/admin/calendar')
    return { ok: true, message: `${feed.label} disconnected.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not remove it.' }
  }
}
