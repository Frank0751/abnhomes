'use client'

import { useActionState, useState } from 'react'
import { createLeaseAction, type ActionResult } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Panel } from '@/components/admin/ui'
import { formatMinor } from '@/lib/core/money'
import { Loader2 } from 'lucide-react'

export function LeaseForm({
  units,
}: {
  units: Array<{ id: string; label: string; suggestedRent: number | null }>
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createLeaseAction,
    null
  )

  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [rent, setRent] = useState(units[0]?.suggestedRent ?? 0)
  const [advanceMonths, setAdvanceMonths] = useState(12)

  const advanceValue = Math.round(rent * advanceMonths * 100)

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Panel title="Unit and term">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="unitId">Unit</Label>
              <Select
                name="unitId"
                value={unitId}
                onValueChange={(value) => {
                  setUnitId(value)
                  const unit = units.find((u) => u.id === value)
                  if (unit?.suggestedRent) setRent(unit.suggestedRent)
                }}
              >
                <SelectTrigger id="unitId">
                  <SelectValue placeholder="Choose a unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {units.length === 0 && (
                <p className="text-xs text-amber-800">
                  No units are set to long let. Change a unit&rsquo;s letting mode first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Starts</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Ends</Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
          </div>
        </Panel>

        <Panel title="Tenant">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tenantName">Full name</Label>
              <Input id="tenantName" name="tenantName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantPhone">Phone</Label>
              <Input id="tenantPhone" name="tenantPhone" type="tel" placeholder="024 170 4048" />
              <p className="text-xs text-muted-foreground">
                Doubles as their sign-in for the tenant portal.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantEmail">Email</Label>
              <Input id="tenantEmail" name="tenantEmail" type="email" placeholder="optional" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ghanaCard">Ghana Card</Label>
              <Input id="ghanaCard" name="ghanaCard" placeholder="GHA-123456789-0" />
            </div>
          </div>
        </Panel>

        <Panel title="Money">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rent">Rent per cycle (GHS)</Label>
              <Input
                id="rent"
                name="rent"
                type="number"
                step="0.01"
                min="0.01"
                value={rent}
                onChange={(e) => setRent(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cycle">Billing cycle</Label>
              <Select name="cycle" defaultValue="MONTHLY">
                <SelectTrigger id="cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="SEMI_ANNUAL">Every six months</SelectItem>
                  <SelectItem value="ANNUAL">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDay">Due on day</Label>
              <Input
                id="dueDay"
                name="dueDay"
                type="number"
                min={1}
                max={28}
                defaultValue={1}
                required
              />
              <p className="text-xs text-muted-foreground">
                Capped at 28 so February always works.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit">Security deposit (GHS)</Label>
              <Input id="deposit" name="deposit" type="number" step="0.01" min="0" defaultValue={0} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="advanceMonths">Months paid in advance</Label>
              <Input
                id="advanceMonths"
                name="advanceMonths"
                type="number"
                min={0}
                max={60}
                value={advanceMonths}
                onChange={(e) => setAdvanceMonths(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="escalationPercent">Yearly escalation (%)</Label>
              <Input
                id="escalationPercent"
                name="escalationPercent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={0}
              />
              <p className="text-xs text-muted-foreground">
                Compounds on each anniversary of the start date.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceChargeLabel">Recurring charge</Label>
              <Input
                id="serviceChargeLabel"
                name="serviceChargeLabel"
                placeholder="Service charge — security and grounds"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceCharge">Amount per cycle (GHS)</Label>
              <Input
                id="serviceCharge"
                name="serviceCharge"
                type="number"
                step="0.01"
                min="0"
                placeholder="Leave blank if none"
              />
            </div>
          </div>
        </Panel>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Panel title="Advance rent">
          <div className="space-y-3 p-4 text-sm">
            {advanceMonths > 0 ? (
              <>
                <p>
                  <strong className="font-serif text-xl">
                    {formatMinor(advanceValue, 'GHS')}
                  </strong>
                  <span className="block text-xs text-muted-foreground">
                    {advanceMonths} months at {formatMinor(Math.round(rent * 100), 'GHS')}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Recorded as credit on the tenant&rsquo;s account, not as income. The rent run
                  consumes it one month at a time, so the owner is only ever credited with the
                  month actually earned.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                No advance. Rent is billed each cycle as it falls due.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Create">
          <div className="space-y-4 p-4">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox name="activate" defaultChecked className="mt-0.5" />
              <span>
                Activate immediately
                <span className="block text-xs text-muted-foreground">
                  Makes the lease visible to the rent run. Leave unticked to keep it a draft.
                </span>
              </span>
            </label>

            {advanceMonths > 0 && (
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox name="advancePaid" className="mt-0.5" />
                <span>
                  The advance has been received
                  <span className="block text-xs text-muted-foreground">
                    Records {formatMinor(advanceValue, 'GHS')} as a payment on account now.
                  </span>
                </span>
              </label>
            )}

            {state && !state.ok && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending || units.length === 0}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create lease
            </Button>
          </div>
        </Panel>

        <p className="px-1 text-xs text-muted-foreground">
          Ghana&rsquo;s Rent Act is commonly read as capping advance rent at six months for a
          monthly tenancy. The system will record any term you enter — confirm with your lawyer
          what ABN should be offering.
        </p>
      </aside>
    </form>
  )
}
