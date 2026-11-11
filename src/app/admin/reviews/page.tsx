import { Star, ShieldAlert, Eye, MessageSquare } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, Pill, EmptyState, StatGrid, StatCard } from '@/components/admin/ui'
import { formatDate } from '@/lib/core/dates'
import {
  respondToReviewAction,
  submitHostReviewAction,
  hideReviewAction,
  publishReviewAction,
} from './actions'
import { RespondForm, HostReviewForm, ModerateButtons } from './review-forms'

export const dynamic = 'force-dynamic'

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`size-3.5 ${i < n ? 'fill-[#0d9488] text-[#0d9488]' : 'text-black/15'}`} />
      ))}
    </span>
  )
}

export default async function AdminReviewsPage() {
  await requirePermission('reviews:moderate')

  const [reviews, pendingCheckouts] = await Promise.all([
    db.review.findMany({
      include: {
        authorParty: { select: { name: true } },
        authorUser: { select: { name: true } },
        reservation: { select: { code: true, checkOut: true } },
        unit: { select: { name: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    // Recent checkouts the host has not reviewed yet — the other half of the blind.
    db.reservation.findMany({
      where: { status: 'CHECKED_OUT', reviews: { none: { authorRole: 'HOST' } } },
      include: { guest: { select: { name: true } }, unit: { select: { name: true } } },
      orderBy: { checkOut: 'desc' },
      take: 8,
    }),
  ])

  const pending = reviews.filter((r) => r.status === 'PENDING')
  const live = reviews.filter((r) => r.status === 'PUBLISHED')
  const hidden = reviews.filter((r) => r.status === 'HIDDEN')
  const avg = live.length ? live.reduce((s, r) => s + r.rating, 0) / live.length : 0

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Double-blind: nothing shows until both sides have spoken or the 14-day window closes. Hide with a reason — never edit."
      />

      <StatGrid>
        <StatCard label="Awaiting the other side" value={String(pending.length)} sublabel="double-blind pending" tone={pending.length > 0 ? 'warning' : 'default'} />
        <StatCard label="Published" value={String(live.length)} sublabel="shown on listings" />
        <StatCard label="Average rating" value={avg ? avg.toFixed(2) : '—'} sublabel={`${live.length} guest reviews`} tone="positive" />
        <StatCard label="Hidden" value={String(hidden.length)} tone={hidden.length > 0 ? 'critical' : 'default'} sublabel="removed by moderators" />
      </StatGrid>

      {pendingCheckouts.length > 0 && (
        <Panel title="Review your guests" description="Recent checkouts without a host review. Private to hosts — but it unlocks the guest's review." className="mt-6">
          <ul className="divide-y divide-black/[0.06]">
            {pendingCheckouts.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {r.guest.name} · {r.unit.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.code} · checked out {formatDate(r.checkOut)}
                    </p>
                  </div>
                  <HostReviewForm reservationId={r.id} action={submitHostReviewAction} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="All reviews" className="mt-6">
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Reviews arrive after the first completed stays." />
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {reviews.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars n={r.rating} />
                      <Pill tone={r.status === 'PUBLISHED' ? 'positive' : r.status === 'HIDDEN' ? 'critical' : 'warning'}>
                        {r.status === 'PENDING' ? 'Blind — awaiting the other side' : r.status === 'PUBLISHED' ? 'Published' : 'Hidden'}
                      </Pill>
                      <span className="text-xs text-muted-foreground">
                        {r.authorRole === 'GUEST' ? r.authorParty?.name : `Host · ${r.authorUser?.name}`} · {r.unit.name}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground/85">{r.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.reservation.code} · stay ended {formatDate(r.reservation.checkOut)}
                      {r.windowEndsAt && r.status === 'PENDING' && ` · reveals ${formatDate(r.windowEndsAt)}`}
                    </p>
                    {r.privateNote && (
                      <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                        <ShieldAlert className="mr-1 inline size-3" />
                        Private note: {r.privateNote}
                      </p>
                    )}
                    {r.hostResponse && (
                      <p className="mt-1.5 rounded-lg bg-[#f7f5f0] px-3 py-2 text-xs text-foreground/80">
                        <MessageSquare className="mr-1 inline size-3" />
                        Host replied: {r.hostResponse}
                      </p>
                    )}
                    {r.moderationNote && (
                      <p className="mt-1 text-xs text-red-700">Moderator note: {r.moderationNote}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {r.authorRole === 'GUEST' && r.status !== 'HIDDEN' && !r.hostResponse && (
                      <RespondForm reviewId={r.id} action={respondToReviewAction} />
                    )}
                    <ModerateButtons
                      reviewId={r.id}
                      status={r.status}
                      hideAction={hideReviewAction}
                      publishAction={publishReviewAction}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3" />
        Reviews publish automatically when both sides submit, or when the window closes — the sweeper
        cron handles it every 15 minutes.
      </p>
    </div>
  )
}
