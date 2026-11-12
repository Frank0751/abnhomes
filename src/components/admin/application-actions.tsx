'use client'

/**
 * Review actions for the applications queues.
 *
 * Every destructive or outward-facing decision (decline, reject) demands a
 * note — the applicant reads it on their tracking page, so "no reason" is not
 * an option. Approve flows keep the note optional because good news needs no
 * explanation.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileSignature, Loader2, ThumbsDown, Search } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  approvePurchaseAction,
  declinePurchaseAction,
  contractPurchaseAction,
  screenApplicationAction,
  approveApplicationAction,
  rejectApplicationAction,
  convertApplicationAction,
  type ApplicationActionResult,
} from '@/app/admin/applications/actions'

const noteCls =
  'w-full rounded-lg border border-black/12 px-3 py-2 text-sm outline-none transition focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20'

function ToastResult(result: ApplicationActionResult, refresh: () => void) {
  if (result.ok) {
    toast({ title: result.message })
    refresh()
  } else {
    toast({ title: 'Not completed', description: result.error, variant: 'destructive' })
  }
}

// ---------------------------------------------------------------------------
// Purchase: approve / decline a fresh application
// ---------------------------------------------------------------------------

export function PurchaseReviewActions({ purchaseId }: { purchaseId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')

  const run = (fn: (id: string, note: string) => Promise<ApplicationActionResult>) =>
    startTransition(async () => ToastResult(await fn(purchaseId, note), () => router.refresh()))

  return (
    <div className="space-y-2.5">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note to the buyer (required to decline)…"
        className={noteCls}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(approvePurchaseAction)}
          className="flex-1 bg-[#0d9488] hover:bg-[#0f766e]"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Approve offer
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(declinePurchaseAction)} className="flex-1">
          <ThumbsDown className="size-4" />
          Decline
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Purchase: contract an approved offer (price, deposit, spread)
// ---------------------------------------------------------------------------

export function PurchaseContractForm({
  purchaseId,
  suggestedOffer,
}: {
  purchaseId: string
  suggestedOffer: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [offer, setOffer] = useState((suggestedOffer / 100).toFixed(0))
  const [deposit, setDeposit] = useState(String(Math.round(suggestedOffer / 100 * 0.2)))
  const [months, setMonths] = useState('24')
  const [firstDue, setFirstDue] = useState(new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  const submit = () =>
    startTransition(async () => {
      const result = await contractPurchaseAction(purchaseId, Number(offer), Number(deposit), Number(months), firstDue, note)
      ToastResult(result, () => router.refresh())
    })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agreed price (GHS)</span>
          <Input value={offer} onChange={(e) => setOffer(e.target.value)} type="number" min={1} step={1000} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deposit (GHS)</span>
          <Input value={deposit} onChange={(e) => setDeposit(e.target.value)} type="number" min={0} step={1000} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Installments</span>
          <Input value={months} onChange={(e) => setMonths(e.target.value)} type="number" min={1} max={60} required />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">First installment due</span>
        <Input value={firstDue} onChange={(e) => setFirstDue(e.target.value)} type="date" required />
      </label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contract note (optional)…" className={noteCls} />
      <Button onClick={submit} disabled={pending} className="w-full bg-[#0a0e1a] hover:bg-[#1a2233]">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />}
        Freeze plan &amp; post installments
      </Button>
      <p className="text-xs text-muted-foreground">
        Posting is run-key guarded: re-submitting the same plan never double-charges.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tenancy: screen / approve / reject / convert
// ---------------------------------------------------------------------------

export function TenancyReviewActions({
  applicationId,
  status,
  suggestedRentMinor,
}: {
  applicationId: string
  status: string
  suggestedRentMinor: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [rent, setRent] = useState((suggestedRentMinor / 100).toFixed(0))

  const run = (fn: (id: string, note: string) => Promise<ApplicationActionResult>) =>
    startTransition(async () => ToastResult(await fn(applicationId, note), () => router.refresh()))

  const convert = () =>
    startTransition(async () => {
      const result = await convertApplicationAction(applicationId, rent)
      ToastResult(result, () => router.refresh())
    })

  return (
    <div className="space-y-2.5">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note to the applicant (required to reject)…"
        className={noteCls}
      />
      {status === 'NEW' && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(screenApplicationAction)} className="w-full">
          <Search className="size-4" /> Start screening
        </Button>
      )}
      {(status === 'NEW' || status === 'SCREENING') && (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(approveApplicationAction)}
            className="flex-1 bg-[#0d9488] hover:bg-[#0f766e]"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(rejectApplicationAction)} className="flex-1">
            <ThumbsDown className="size-4" />
            Reject
          </Button>
        </div>
      )}
      {status === 'APPROVED' && (
        <div className="rounded-lg bg-[#0d9488]/5 p-3">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Monthly rent for the lease (GHS)
          </span>
          <div className="flex gap-2">
            <Input value={rent} onChange={(e) => setRent(e.target.value)} type="number" min={1} step={50} />
            <Button size="sm" disabled={pending} onClick={convert} className="shrink-0 bg-[#0d9488] hover:bg-[#0f766e]">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />}
              Create lease
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Creates an active lease, occupies the unit and puts the applicant into the rent run.
          </p>
        </div>
      )}
    </div>
  )
}
