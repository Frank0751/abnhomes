'use client'

/**
 * Booking-site calendar sync, per unit.
 *
 * Two directions, and both matter. Paste ABN's feed into Airbnb so they block
 * our sold nights; paste theirs in here so we block theirs. Neither is instant
 * — the platforms poll every few hours — so the panel says so rather than
 * implying a guarantee it cannot make.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addFeedAction, removeFeedAction, syncFeedAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel, Pill } from '@/components/admin/ui'
import { toast } from '@/hooks/use-toast'
import { Check, Copy, Loader2, RefreshCw, Trash2 } from 'lucide-react'

type Feed = {
  id: string
  label: string
  url: string
  lastSyncAt: string | null
  lastError: string | null
  eventCount: number
}

export function FeedManager({
  unitId,
  publicFeedUrl,
  feeds,
}: {
  unitId: string
  publicFeedUrl: string
  feeds: Feed[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState(false)
  const [adding, setAdding] = useState(false)

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const result = await action()
      if (result.ok) {
        toast({ title: result.message ?? 'Done' })
        router.refresh()
      } else {
        toast({ title: 'That did not work', description: result.error, variant: 'destructive' })
      }
    })
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicFeedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Could not copy', description: 'Select the URL and copy it manually.' })
    }
  }

  return (
    <>
      <Panel
        title="Publish this calendar"
        description="Paste into Airbnb or Booking.com so they block the nights ABN has sold."
      >
        <div className="space-y-2 p-4">
          <div className="flex gap-2">
            <Input readOnly value={publicFeedUrl} className="font-mono text-[11px]" />
            <Button variant="outline" size="icon" onClick={copyUrl} aria-label="Copy feed URL">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Shows only that a night is taken — never the guest, the price, or the booking.
          </p>
        </div>
      </Panel>

      <Panel
        title="Import their calendars"
        description="Blocks dates here that were sold on the booking sites."
        actions={
          !adding && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(true)}>
              Add feed
            </Button>
          )
        }
      >
        {adding && (
          <form
            className="space-y-3 border-b border-black/8 p-4"
            action={(formData) => {
              run(async () => {
                const result = await addFeedAction(unitId, formData)
                if (result.ok) setAdding(false)
                return result
              })
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="label" className="text-xs">
                Where from
              </Label>
              <Input id="label" name="label" placeholder="Airbnb" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url" className="text-xs">
                Calendar URL
              </Label>
              <Input
                id="url"
                name="url"
                type="url"
                placeholder="https://www.airbnb.com/calendar/ical/…"
                required
                className="font-mono text-[11px]"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                Connect and sync
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {feeds.length === 0 && !adding && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No feeds connected. Without one, a booking taken on Airbnb will not block this
            calendar.
          </p>
        )}

        <ul className="divide-y divide-black/6">
          {feeds.map((feed) => (
            <li key={feed.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{feed.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{feed.url}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {feed.lastError ? (
                      <Pill tone="critical">Failed</Pill>
                    ) : (
                      <Pill tone="positive">{feed.eventCount} blocked</Pill>
                    )}
                    {feed.lastSyncAt && <span>Last checked {feed.lastSyncAt}</span>}
                  </p>
                  {feed.lastError && (
                    <p className="mt-1 text-xs text-red-700">{feed.lastError}</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={pending}
                    onClick={() => run(() => syncFeedAction(feed.id))}
                    aria-label={`Sync ${feed.label}`}
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive"
                    disabled={pending}
                    onClick={() => run(() => removeFeedAction(feed.id))}
                    aria-label={`Remove ${feed.label}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="px-1 text-xs text-muted-foreground">
        Feed sync runs hourly and is not instant — the platforms poll on their own schedule. For a
        same-day direct booking, still glance at the Airbnb app.
      </p>
    </>
  )
}
