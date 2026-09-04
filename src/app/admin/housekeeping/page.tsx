/**
 * The changeover board.
 *
 * Housekeeping runs off a phone, in a stairwell, often without signal — so
 * this screen is deliberately plain: what to clean, where, by when, and one
 * button to say it is done.
 */

import { requirePermission } from '@/lib/session'
import { unitScopeWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { dateOnly, formatDate, formatDateTime, today } from '@/lib/core/dates'
import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  humanise,
} from '@/components/admin/ui'
import { CompleteTaskButton } from './complete-button'

export default async function HousekeepingPage() {
  const actor = await requirePermission('housekeeping:read')
  const now = new Date()
  const endOfToday = new Date(dateOnly(now).getTime() + 86_400_000)

  const [overdue, dueToday, upcoming, doneToday] = await Promise.all([
    db.housekeepingTask.findMany({
      where: { status: 'PENDING', dueAt: { lt: dateOnly(now) }, ...unitScopeWhere(actor) },
      include: taskInclude,
      orderBy: { dueAt: 'asc' },
    }),
    db.housekeepingTask.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueAt: { gte: dateOnly(now), lt: endOfToday },
        ...unitScopeWhere(actor),
      },
      include: taskInclude,
      orderBy: { dueAt: 'asc' },
    }),
    db.housekeepingTask.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueAt: { gte: endOfToday },
        ...unitScopeWhere(actor),
      },
      include: taskInclude,
      orderBy: { dueAt: 'asc' },
      take: 30,
    }),
    db.housekeepingTask.count({
      where: {
        status: 'DONE',
        completedAt: { gte: dateOnly(now) },
        ...unitScopeWhere(actor),
      },
    }),
  ])

  return (
    <>
      <PageHeader
        title="Housekeeping"
        description={`${formatDate(today())}. Every departure creates a changeover automatically — nothing here has to be remembered.`}
      />

      <StatGrid>
        <StatCard
          label="Overdue"
          value={String(overdue.length)}
          sublabel="Should already be done"
          tone={overdue.length > 0 ? 'critical' : 'positive'}
        />
        <StatCard label="Due today" value={String(dueToday.length)} sublabel="On the board now" />
        <StatCard label="Completed today" value={String(doneToday)} tone="positive" />
        <StatCard label="Coming up" value={String(upcoming.length)} sublabel="Next 30 tasks" />
      </StatGrid>

      <div className="mt-8 space-y-6">
        {overdue.length > 0 && (
          <TaskList title="Overdue" tasks={overdue} tone="critical" />
        )}
        <TaskList title="Due today" tasks={dueToday} emptyText="Nothing due today." />
        <TaskList title="Coming up" tasks={upcoming} emptyText="Nothing scheduled." muted />
      </div>
    </>
  )
}

const taskInclude = {
  unit: { select: { name: true, code: true, property: { select: { name: true } } } },
  reservation: {
    select: { code: true, checkOut: true, guest: { select: { name: true } } },
  },
  assignee: { select: { name: true } },
} as const

type Task = Awaited<
  ReturnType<typeof import('@/lib/db').db.housekeepingTask.findMany<{ include: typeof taskInclude }>>
>[number]

function TaskList({
  title,
  tasks,
  emptyText,
  tone,
  muted,
}: {
  title: string
  tasks: Task[]
  emptyText?: string
  tone?: 'critical'
  muted?: boolean
}) {
  return (
    <Panel title={title} className={tone === 'critical' ? 'border-red-300' : undefined}>
      {tasks.length === 0 ? (
        <EmptyState title={emptyText ?? 'Nothing here'} />
      ) : (
        <ul className="divide-y divide-black/6">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {task.unit.name}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {task.unit.property.name}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Pill tone={muted ? 'neutral' : 'info'}>{humanise(task.type)}</Pill>
                  <span>Due {formatDateTime(task.dueAt)}</span>
                  {task.reservation && (
                    <span>
                      After {task.reservation.guest.name} ({task.reservation.code})
                    </span>
                  )}
                  {task.assignee && <span>· {task.assignee.name}</span>}
                </p>
              </div>

              <CompleteTaskButton taskId={task.id} status={task.status} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
