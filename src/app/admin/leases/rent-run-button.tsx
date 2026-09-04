'use client'

/**
 * The rent run, rehearsed then executed.
 *
 * Nobody should ever learn what this job does by running it against real
 * tenants. The dialog always previews first, and the preview is computed by
 * the same code that does the work — not an approximation of it.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { executeRentRunAction, previewRentRunAction } from './actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Panel, TableScroll } from '@/components/admin/ui'
import { formatMinor } from '@/lib/core/money'
import { toast } from '@/hooks/use-toast'
import { Loader2, Play } from 'lucide-react'
import type { Currency } from '@prisma/client'

type Preview = {
  charges: number
  skipped: number
  totals: Array<{ currency: Currency; minor: number }>
  lateFees: number
  lateFeeTotal: number
  lines: Array<{
    tenant: string
    unit: string
    description: string
    amountMinor: number
    currency: Currency
  }>
}

export function RentRunButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [pending, start] = useTransition()

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setPreview(null)
      start(async () => setPreview(await previewRentRunAction()))
    }
  }

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Play className="mr-1.5 size-3.5" />
          Run rent
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rent run</DialogTitle>
          <DialogDescription>
            Raises every rent and service charge now due, then settles each from any credit the
            tenant holds. Safe to run twice — a period already billed is never billed again.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {pending && !preview && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Working out what is due…
            </p>
          )}

          {preview && (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Figure label="Charges to raise" value={String(preview.charges)} />
                <Figure
                  label="Value"
                  value={
                    preview.totals.length === 0
                      ? '—'
                      : preview.totals
                          .map((t) => formatMinor(t.minor, t.currency))
                          .join(' · ')
                  }
                />
                <Figure
                  label="Late fees"
                  value={
                    preview.lateFees === 0
                      ? 'None'
                      : `${preview.lateFees} · ${formatMinor(preview.lateFeeTotal, 'GHS')}`
                  }
                />
              </div>

              {preview.skipped > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">
                  {preview.skipped} period{preview.skipped === 1 ? '' : 's'} already billed by an
                  earlier run and will be left alone.
                </p>
              )}

              {preview.lines.length > 0 ? (
                <Panel className="max-h-64 overflow-y-auto">
                  <TableScroll>
                    <table className="w-full min-w-[440px] text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                          <th className="px-3 py-2 text-left font-semibold">Tenant</th>
                          <th className="px-3 py-2 text-left font-semibold">Charge</th>
                          <th className="px-3 py-2 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/6">
                        {preview.lines.map((line, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5">{line.tenant}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {line.description}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {formatMinor(line.amountMinor, line.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableScroll>
                </Panel>
              ) : (
                <p className="rounded border border-dashed border-black/12 px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing to raise. Every period due has already been billed.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => toggle(false)}>
            Close
          </Button>
          <Button
            disabled={pending || !preview || preview.charges === 0}
            onClick={() =>
              start(async () => {
                const result = await executeRentRunAction()
                if (result.ok) {
                  toast({ title: result.message ?? 'Rent run complete' })
                  toggle(false)
                  router.refresh()
                } else {
                  toast({ title: 'Run failed', description: result.error, variant: 'destructive' })
                }
              })
            }
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Raise these charges
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-black/8 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-serif text-lg tabular-nums">{value}</p>
    </div>
  )
}
