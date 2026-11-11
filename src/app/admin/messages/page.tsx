import { Mail, MessageCircle, Smartphone, Send } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { channelConfig } from '@/lib/notify'
import { PageHeader, Panel, Pill, StatCard, StatGrid, TableScroll, EmptyState } from '@/components/admin/ui'
import { resendMessageAction, sendTestMessageAction } from './actions'
import { TestMessageForm } from './test-form'

export const dynamic = 'force-dynamic'

const CHANNEL_ICON = {
  EMAIL: Mail,
  SMS: Smartphone,
  WHATSAPP: MessageCircle,
} as const

const STATUS_TONE = {
  QUEUED: 'warning',
  SENT: 'positive',
  DELIVERED: 'positive',
  FAILED: 'critical',
} as const

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string }>
}) {
  await requirePermission('settings:write')
  const { channel, status } = await searchParams
  const config = channelConfig()

  const where = {
    ...(channel && ['EMAIL', 'SMS', 'WHATSAPP'].includes(channel)
      ? { channel: channel as 'EMAIL' | 'SMS' | 'WHATSAPP' }
      : {}),
    ...(status && ['QUEUED', 'SENT', 'FAILED'].includes(status)
      ? { status: status as 'QUEUED' | 'SENT' | 'FAILED' }
      : {}),
  }

  const [messages, counts] = await Promise.all([
    db.messageLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 120 }),
    db.messageLog.groupBy({ by: ['status'], _count: true }),
  ])
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0

  const channels = [
    { key: 'EMAIL', label: 'Email', configured: config.email.configured, detail: config.email.configured ? 'Resend' : 'Simulated — set RESEND_API_KEY to send for real' },
    { key: 'WHATSAPP', label: 'WhatsApp', configured: config.whatsapp.configured, detail: config.whatsapp.configured ? 'WhatsApp Cloud API' : 'Simulated — set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID' },
    { key: 'SMS', label: 'SMS', configured: config.sms.configured, detail: config.sms.configured ? (process.env.SMS_PROVIDER ?? '').toUpperCase() : 'Simulated — set SMS_PROVIDER + SMS_API_KEY' },
  ]

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Every email, SMS and WhatsApp the platform sends — confirmations, receipts, reminders — flows through this outbox with retry and delivery status."
      />

      <StatGrid>
        <StatCard label="Queued" value={String(count('QUEUED'))} sublabel="awaiting delivery or retry" tone={count('QUEUED') > 0 ? 'warning' : 'default'} />
        <StatCard label="Sent" value={String(count('SENT'))} sublabel="accepted by the provider" tone="positive" />
        <StatCard label="Failed" value={String(count('FAILED'))} sublabel="exhausted retries — needs a human" tone={count('FAILED') > 0 ? 'critical' : 'default'} />
      </StatGrid>

      <Panel title="Channels" description="Provider configuration is read live from environment variables." className="mt-6">
        <div className="grid gap-px bg-black/5 sm:grid-cols-3">
          {channels.map((c) => {
            const Icon = CHANNEL_ICON[c.key as keyof typeof CHANNEL_ICON]
            return (
              <div key={c.key} className="bg-white px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-[#0d9488]" />
                    {c.label}
                  </span>
                  <Pill tone={c.configured ? 'positive' : 'neutral'}>{c.configured ? 'Live' : 'Simulated'}</Pill>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{c.detail}</p>
              </div>
            )
          })}
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Outbox"
          description="Most recent 120 messages. Retry with backoff is automatic; resend for a manual kick."
          actions={
            <div className="flex gap-1.5 text-[11px]">
              {['', 'EMAIL', 'SMS', 'WHATSAPP'].map((c) => (
                <a
                  key={c || 'all'}
                  href={`/admin/messages${c ? `?channel=${c}` : ''}`}
                  className={`rounded-full px-2.5 py-1 transition ${channel === c ? 'bg-[#0d9488] text-white' : 'bg-black/5 hover:bg-black/10'}`}
                >
                  {c || 'All'}
                </a>
              ))}
            </div>
          }
        >
          {messages.length === 0 ? (
            <EmptyState
              title="No messages yet"
              description="Confirm a booking or record a payment and the outbox will fill up here."
            />
          ) : (
            <TableScroll>
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Channel</th>
                    <th className="px-3 py-2.5 font-medium">To</th>
                    <th className="px-3 py-2.5 font-medium">Template</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">When</th>
                    <th className="px-5 py-2.5 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => {
                    const Icon = CHANNEL_ICON[m.channel]
                    return (
                      <tr key={m.id} className="border-b border-black/5 last:border-0 align-top">
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px]">
                            <Icon className="size-3.5 text-[#5b6472]" />
                            {m.channel}
                          </span>
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-3 text-[13px]" title={m.toAddress}>
                          {m.toAddress}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-muted-foreground">{m.template ?? '—'}</td>
                        <td className="px-3 py-3">
                          <Pill tone={STATUS_TONE[m.status] ?? 'neutral'}>
                            <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
                            {m.status}
                            {m.attempts > 1 && m.status === 'QUEUED' ? ` · try ${m.attempts}` : ''}
                          </Pill>
                          {m.error && (
                            <p className="mt-1 max-w-[220px] truncate text-[11px] text-red-700" title={m.error}>
                              {m.error}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-[12px] text-muted-foreground">
                          {new Date(m.sentAt ?? m.scheduledFor ?? m.createdAt).toLocaleString('en-GB', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {(m.status === 'FAILED' || m.status === 'QUEUED') && (
                            <form action={resendMessageAction}>
                              <input type="hidden" name="id" value={m.id} />
                              <button className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-[11px] font-medium transition hover:bg-black/5">
                                <Send className="size-3" /> Resend
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Send a test" description="Goes through the real outbox exactly as a guest would receive it.">
            <TestMessageForm action={sendTestMessageAction} />
          </Panel>
          <Panel title="How delivery works">
            <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-muted-foreground">
              <p>
                Messages are queued in the database first, then delivered by the outbox worker
                every 15 minutes. A provider outage retries five times with growing gaps.
              </p>
              <p>
                Simulated channels print the full message to the server log and mark it sent —
                so demos work end to end, and nothing pretends to have delivered when it has not.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
