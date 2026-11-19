'use client'

/**
 * Issue a receipt by hand.
 *
 * Built for a clerk with someone standing in front of them: find the payer,
 * type the amount, pick how it arrived, done — and the receipt appears
 * immediately with a link to print or send.
 */

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { issueReceiptAction, searchPayersAction, type IssueResult } from './issue-receipt-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatPhone } from '@/lib/core/phone'
import { CheckCircle2, Loader2, Printer, ReceiptText, Search } from 'lucide-react'

type Payer = {
  id: string
  name: string
  phone: string | null
  isTenant: boolean
  isGuest: boolean
  isOwner: boolean
}

export function IssueReceiptDialog({
  properties,
}: {
  properties: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<IssueResult | null, FormData>(
    issueReceiptAction,
    null
  )

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Payer[]>([])
  const [payer, setPayer] = useState<Payer | null>(null)
  const [searching, startSearch] = useTransition()

  // Debounced lookup — a clerk types faster than a round trip.
  useEffect(() => {
    if (payer || query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      startSearch(async () => setResults(await searchPayersAction(query)))
    }, 250)
    return () => clearTimeout(timer)
  }, [query, payer])

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  function reset() {
    setQuery('')
    setResults([])
    setPayer(null)
  }

  // ---------------------------------------------------------------- issued
  if (state?.ok && open) {
    return (
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-[var(--state-free-solid)]" />
              Receipt issued
            </DialogTitle>
            <DialogDescription>{state.message}</DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-secondary px-4 py-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Receipt number
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {state.receiptNumber}
            </p>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => { setOpen(false); reset() }}>
              Done
            </Button>
            <Button asChild>
              <a href={state.receiptUrl} target="_blank" rel="noreferrer">
                <Printer className="mr-1.5 size-4" />
                Open receipt
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ----------------------------------------------------------------- form
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <ReceiptText className="mr-1.5 size-4" />
          Issue receipt
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Issue a receipt</DialogTitle>
            <DialogDescription>
              For cash, a transfer or a mobile money payment taken outside the gateway.
              It posts to the ledger and settles the oldest charges first, exactly as an
              online payment would.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* ------------------------------------------------------ payer */}
            <div className="space-y-2">
              <Label htmlFor="payer-search">Who paid</Label>

              {payer ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--accent)] bg-[var(--accent-wash)] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payer.name}</p>
                    {payer.phone && (
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(payer.phone)}
                      </p>
                    )}
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={reset}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="payer-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Name, phone or email"
                      autoComplete="off"
                      className="pl-9"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {results.length > 0 && (
                    <ul className="max-h-44 overflow-y-auto rounded-lg border border-border">
                      {results.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setPayer(r)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{r.name}</span>
                              {r.phone && (
                                <span className="block text-xs text-muted-foreground">
                                  {formatPhone(r.phone)}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {r.isTenant ? 'Tenant' : r.isOwner ? 'Owner' : 'Guest'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {query.trim().length >= 2 && !searching && results.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nobody matches. Check the spelling, or add them from Bookings or
                      Leases first.
                    </p>
                  )}
                </>
              )}

              <input type="hidden" name="partyId" value={payer?.id ?? ''} />
            </div>

            {/* --------------------------------------------------- property */}
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property</Label>
              <Select name="propertyId" defaultValue={properties[0]?.id}>
                <SelectTrigger id="propertyId">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ----------------------------------------------------- amount */}
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount received</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  className="font-mono text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select name="currency" defaultValue="GHS">
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GHS">GHS ₵</SelectItem>
                    <SelectItem value="USD">USD $</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="channel">How it arrived</Label>
                <Select name="channel" defaultValue="CASH">
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="MOMO_MTN">MTN MoMo</SelectItem>
                    <SelectItem value="MOMO_TELECEL">Telecel Cash</SelectItem>
                    <SelectItem value="MOMO_AIRTELTIGO">AirtelTigo Money</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receivedAt">When</Label>
                <Input
                  id="receivedAt"
                  name="receivedAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                name="reference"
                placeholder="Transaction id, teller slip, or a note"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Note on the receipt</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Optional — the payer sees this."
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox name="provisional" className="mt-0.5" />
              <span>
                Taken in the field, not yet counted in
                <span className="block text-xs text-muted-foreground">
                  The receipt is issued straight away but marked awaiting confirmation
                  until the office reconciles it against the cash float.
                </span>
              </span>
            </label>

            {state && !state.ok && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !payer}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Record payment and issue receipt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
