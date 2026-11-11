import { Receipt, CheckCircle2 } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission, currentActor } from '@/lib/session'
import { can } from '@/lib/rbac'
import { PageHeader, Panel, Pill, EmptyState, Money } from '@/components/admin/ui'
import { formatDate } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { createExpenseAction, approveExpenseAction } from './actions'
import { ExpenseForm, ApproveButton } from './forms'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const actor = await requirePermission('money:record')
  const canAdjust = can(actor, 'money:adjust')

  const [expenses, properties, vendors] = await Promise.all([
    db.expense.findMany({
      include: {
        property: { select: { name: true } },
        unit: { select: { name: true } },
        vendor: { select: { name: true } },
      },
      orderBy: { incurredAt: 'desc' },
      take: 80,
    }),
    db.property.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.party.findMany({ where: { isVendor: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const pending = expenses.filter((e) => !e.approvedAt)
  const pendingMinor = pending.reduce((s, e) => s + e.amountMinor, 0)

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Operating spend with a category and a vendor, posted to the ledger on approval so owner statements stay honest."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel
            title="Awaiting approval"
            description={pending.length > 0 ? `${pending.length} expense${pending.length === 1 ? '' : 's'} not yet posted to the ledger.` : 'Everything is posted.'}
          >
            {pending.length === 0 ? (
              <EmptyState title="Nothing to approve" description="New expenses appear here for review before they hit the ledger." />
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {pending.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{e.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.code} · {e.property.name}
                        {e.unit ? ` · ${e.unit.name}` : ''} · {e.category.toLowerCase()}
                        {e.vendor ? ` · ${e.vendor.name}` : ''} · {formatDate(e.incurredAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Money minor={e.amountMinor} currency={e.currency} className="font-medium" />
                      {canAdjust && <ApproveButton expenseId={e.id} action={approveExpenseAction} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="All expenses" description={`Latest 80. Unapproved total: ${formatMinor(pendingMinor, 'GHS')}.`}>
            {expenses.length === 0 ? (
              <EmptyState title="No expenses yet" description="Record the first one on the right." />
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Receipt className="size-4 shrink-0 text-[#5b6472]" />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{e.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.property.name} · {e.category.toLowerCase()} · {formatDate(e.incurredAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {e.approvedAt ? (
                        <Pill tone="positive">
                          <CheckCircle2 className="size-3" /> posted
                        </Pill>
                      ) : (
                        <Pill tone="warning">draft</Pill>
                      )}
                      <Money minor={e.amountMinor} currency={e.currency} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Record an expense" description="Draft first; approval posts it to the ledger.">
          <ExpenseForm properties={properties} vendors={vendors} action={createExpenseAction} />
        </Panel>
      </div>
    </div>
  )
}
