'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  issueStatementAction,
  markStatementPaidAction,
  previewStatementAction,
} from './actions'
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
import { formatMinor } from '@/lib/core/money'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import type { Currency } from '@prisma/client'

type Preview = {
  propertyName: string
  ownerName: string
  currency: Currency
  grossRevenueMinor: number
  managementFeeMinor: number
  expensesMinor: number
  netPayableMinor: number
  lineCount: number
}

export function GenerateStatementButton({
  propertyId,
  periodStart,
  periodEnd,
}: {
  propertyId: string
  periodStart: string
  periodEnd: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [pending, start] = useTransition()

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setPreview(null)
      start(async () => {
        setPreview(await previewStatementAction(propertyId, periodStart, periodEnd))
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          Generate
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Owner statement</DialogTitle>
          <DialogDescription>
            Issuing freezes these figures and posts the management fee and the balance owed. A
            reissued statement will never show different numbers.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {pending && !preview && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Adding it up…
            </p>
          )}

          {preview && (
            <dl className="space-y-2 text-sm">
              <Row label="Property" value={preview.propertyName} />
              <Row label="Owner" value={preview.ownerName} />
              <div className="my-3 border-t border-black/8" />
              <Row
                label="Revenue earned"
                value={formatMinor(preview.grossRevenueMinor, preview.currency)}
              />
              <Row
                label="Management fee"
                value={
                  preview.managementFeeMinor > 0
                    ? `− ${formatMinor(preview.managementFeeMinor, preview.currency)}`
                    : 'None'
                }
              />
              <Row
                label="Costs"
                value={
                  preview.expensesMinor > 0
                    ? `− ${formatMinor(preview.expensesMinor, preview.currency)}`
                    : 'None'
                }
              />
              <div className="my-3 border-t border-black/8" />
              <Row
                label="Net due to owner"
                value={formatMinor(preview.netPayableMinor, preview.currency)}
                strong
              />
              <p className="pt-2 text-xs text-muted-foreground">
                From {preview.lineCount} ledger entr{preview.lineCount === 1 ? 'y' : 'ies'}.
              </p>
            </dl>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => toggle(false)}>
            Not yet
          </Button>
          <Button
            disabled={pending || !preview}
            onClick={() =>
              start(async () => {
                const result = await issueStatementAction(propertyId, periodStart, periodEnd)
                if (result.ok) {
                  toast({ title: result.message ?? 'Issued' })
                  toggle(false)
                  router.refresh()
                } else {
                  toast({ title: 'Not issued', description: result.error, variant: 'destructive' })
                }
              })
            }
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Issue statement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MarkPaidButton({ statementId }: { statementId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await markStatementPaidAction(statementId)
          if (result.ok) {
            toast({ title: result.message ?? 'Marked paid' })
            router.refresh()
          } else {
            toast({ title: 'Not updated', description: result.error, variant: 'destructive' })
          }
        })
      }
    >
      {pending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
      Mark paid
    </Button>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'font-medium' : 'text-muted-foreground'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-serif text-lg' : ''}`}>{value}</dd>
    </div>
  )
}
