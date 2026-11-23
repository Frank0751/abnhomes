'use client'

import { useState } from 'react'
import { FormField, NativeSelect } from '../rooms/form-bits'
import { Input } from '@/components/ui/input'

/**
 * Who owns the building and what ABN charges them. Shared by "add a building"
 * and the administrator's section of "edit building".
 */
export function OwnerFields({
  owners,
  ownerPartyId,
  feePercent,
}: {
  owners: { id: string; name: string }[]
  ownerPartyId: string
  feePercent: string
}) {
  const [owner, setOwner] = useState(ownerPartyId || (owners[0]?.id ?? '__new'))
  const isNew = owner === '__new'

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="ownerPartyId" label="Owner">
        <NativeSelect id="ownerPartyId" name="ownerPartyId" value={owner} onChange={(e) => setOwner(e.target.value)}>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="__new">A new owner…</option>
        </NativeSelect>
      </FormField>
      <FormField id="fee" label="ABN’s management fee (%)" hint="0 for a building ABN owns itself.">
        <Input id="fee" name="fee" type="number" min={0} max={60} step="0.5" defaultValue={feePercent} />
      </FormField>
      {isNew && (
        <>
          <FormField id="newOwnerName" label="Owner’s name" className="sm:col-span-2">
            <Input id="newOwnerName" name="newOwnerName" required maxLength={80} autoComplete="off" />
          </FormField>
          <FormField id="newOwnerPhone" label="Owner’s phone">
            <Input id="newOwnerPhone" name="newOwnerPhone" type="tel" autoComplete="off" />
          </FormField>
          <FormField id="newOwnerEmail" label="Owner’s email">
            <Input id="newOwnerEmail" name="newOwnerEmail" type="email" autoComplete="off" />
          </FormField>
        </>
      )}
    </div>
  )
}
