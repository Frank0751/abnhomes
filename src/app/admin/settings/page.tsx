import { requirePermission } from '@/lib/session'
import { db } from '@/lib/db'
import { supportedChannels, gatewayIsSimulated } from '@/lib/payments/gateway'
import { baseCurrency } from '@/lib/core/ledger'
import { formatDate, formatDateTime } from '@/lib/core/dates'
import { ROLE_LABELS } from '@/lib/rbac'
import {
  PageHeader,
  Panel,
  Pill,
  TableScroll,
  humanise,
} from '@/components/admin/ui'
import { FxRateForm } from './fx-form'

export default async function SettingsPage() {
  await requirePermission('settings:write')

  const [rates, users, feeds, recentAudit] = await Promise.all([
    db.fxRate.findMany({ orderBy: { asOf: 'desc' }, take: 10 }),
    db.user.findMany({
      include: { propertyAccess: { include: { property: { select: { name: true } } } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    db.icalFeed.findMany({
      include: { unit: { select: { name: true, property: { select: { name: true } } } } },
      orderBy: { lastSyncAt: 'desc' },
    }),
    db.auditEvent.findMany({
      include: { actor: { select: { name: true } } },
      orderBy: { at: 'desc' },
      take: 25,
    }),
  ])

  const channels = supportedChannels()
  const failingFeeds = feeds.filter((f) => f.lastError)

  return (
    <>
      <PageHeader
        title="Settings"
        description="Exchange rates, payment channels, access and the audit trail."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Panel
            title="Exchange rate"
            description={`Statements report in ${baseCurrency()}. Historic entries keep the rate they were posted at — this only affects new ones.`}
          >
            <div className="border-b border-black/8 p-4">
              <FxRateForm />
            </div>
            <TableScroll>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Pair</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Effective from</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {rates.map((rate) => (
                    <tr key={rate.id}>
                      <td className="px-4 py-2.5">
                        1 {rate.from} → {rate.to}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {Number(rate.rate).toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatDate(rate.asOf)}
                      </td>
                    </tr>
                  ))}
                  {rates.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        No rates recorded. Cross-currency entries will be refused until one exists.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScroll>
          </Panel>

          <Panel
            title="Payment channels"
            description={
              gatewayIsSimulated()
                ? 'The gateway is in simulation mode — no Paystack key is configured.'
                : 'Live through Paystack.'
            }
          >
            <ul className="divide-y divide-black/6">
              {channels.map((channel) => (
                <li key={channel.channel} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{channel.label}</p>
                      <p className="text-xs text-muted-foreground">{channel.description}</p>
                      {channel.note && (
                        <p className="mt-1 text-xs text-amber-800">{channel.note}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        {channel.currencies.join(', ')}
                      </span>
                      <Pill tone={channel.available ? 'positive' : 'neutral'}>
                        {channel.available ? 'On' : 'Off'}
                      </Pill>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Calendar feeds"
            description="Booking-site calendars imported to block dates here."
            actions={
              failingFeeds.length > 0 ? (
                <Pill tone="critical">{failingFeeds.length} failing</Pill>
              ) : undefined
            }
          >
            {feeds.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No feeds connected. Add one from a unit page.
              </p>
            ) : (
              <ul className="divide-y divide-black/6">
                {feeds.map((feed) => (
                  <li key={feed.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {feed.label}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {feed.unit.name}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {feed.lastSyncAt
                          ? `Last checked ${formatDateTime(feed.lastSyncAt)}`
                          : 'Never synced'}
                      </p>
                      {feed.lastError && (
                        <p className="mt-1 text-xs text-red-700">{feed.lastError}</p>
                      )}
                    </div>
                    <Pill tone={feed.lastError ? 'critical' : 'positive'}>
                      {feed.lastError ? 'Failing' : `${feed.eventCount} blocked`}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="People" description="Who can sign in, and which buildings they can see.">
            <TableScroll>
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Role</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-2.5">
                        {user.name}
                        <span className="block text-xs text-muted-foreground">
                          {user.email ?? user.phone}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill>{ROLE_LABELS[user.role]}</Pill>
                        {!user.active && (
                          <Pill tone="critical" className="ml-1">
                            Disabled
                          </Pill>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {['SUPER_ADMIN', 'FINANCE'].includes(user.role)
                          ? 'All properties'
                          : user.propertyAccess.length === 0
                            ? 'None assigned'
                            : user.propertyAccess.map((a) => a.property.name).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Panel>
        </div>
      </div>

      <Panel
        className="mt-6"
        title="Audit trail"
        description="The last 25 changes. Nothing here can be edited or deleted."
      >
        <TableScroll>
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">When</th>
                <th className="px-4 py-2.5 text-left font-semibold">Who</th>
                <th className="px-4 py-2.5 text-left font-semibold">Action</th>
                <th className="px-4 py-2.5 text-left font-semibold">On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6">
              {recentAudit.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(event.at)}
                  </td>
                  <td className="px-4 py-2.5">
                    {event.actor?.name ?? event.actorLabel ?? 'System'}
                  </td>
                  <td className="px-4 py-2.5">{humanise(event.action.replace(/\./g, ' '))}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {event.entityType}
                  </td>
                </tr>
              ))}
              {recentAudit.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Panel>
    </>
  )
}
