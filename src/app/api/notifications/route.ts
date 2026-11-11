import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/session'

/** In-app notification centre feed for the signed-in user. */
export async function GET() {
  const actor = await currentActor()
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.notification.count({ where: { userId: actor.id, readAt: null } }),
  ])

  return NextResponse.json({ items, unread })
}

/** Mark one or all notifications as read. */
export async function POST(request: NextRequest) {
  const actor = await currentActor()
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean }
  if (body.all) {
    await db.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    })
  } else if (body.id) {
    await db.notification.updateMany({
      where: { id: body.id, userId: actor.id },
      data: { readAt: new Date() },
    })
  }
  return NextResponse.json({ ok: true })
}
