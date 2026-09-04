import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/session'
import { homeRouteFor } from '@/lib/rbac'

/**
 * /portal is a signpost, not a page. Send everyone to the surface that belongs
 * to their role rather than making them find it.
 */
export default async function PortalIndex() {
  const actor = await requireActor()
  redirect(homeRouteFor(actor.role))
}
