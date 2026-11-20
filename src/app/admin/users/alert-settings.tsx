'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AlertLevel } from '@prisma/client'
import { setAlertPreferencesAction } from './alert-actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2, Mail, MessageSquare } from 'lucide-react'

export type AlertPerson = {
  id: string
  name: string
  email: string | null
  phone: string | null
  roleLabel: string
  alertLevel: AlertLevel
  alertEmail: boolean
  alertSms: boolean
}

const LEVELS: Array<{ value: AlertLevel; label: string; hint: string }> = [
  { value: 'NONE', label: 'Console only', hint: 'Sees the bell when signed in. Nothing is sent.' },
  { value: 'IMPORTANT', label: 'Bookings and money', hint: 'Sent the moment they happen.' },
  { value: 'EVERYTHING', label: 'Everything', hint: 'The above, plus a digest each morning.' },
]

export function AlertSettings({ people }: { people: AlertPerson[] }) {
  return (
    <div className="divide-y divide-border">
      {people.map((person) => (
        <PersonRow key={person.id} person={person} />
      ))}
    </div>
  )
}

function PersonRow({ person }: { person: AlertPerson }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [level, setLevel] = useState<AlertLevel>(person.alertLevel)
  const [email, setEmail] = useState(person.alertEmail)
  const [sms, setSms] = useState(person.alertSms)

  const save = (next: { level?: AlertLevel; email?: boolean; sms?: boolean }) => {
    const payload = {
      level: next.level ?? level,
      email: next.email ?? email,
      sms: next.sms ?? sms,
    }
    start(async () => {
      const result = await setAlertPreferencesAction(person.id, payload)
      if (result.ok) {
        toast({ title: result.message })
        router.refresh()
      } else {
        // Put the controls back to what the server still holds, so the screen
        // never shows a setting that was refused.
        setLevel(person.alertLevel)
        setEmail(person.alertEmail)
        setSms(person.alertSms)
        toast({ title: 'Not changed', description: result.error, variant: 'destructive' })
      }
    })
  }

  const quiet = level === 'NONE'

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{person.name}</span>
          {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {person.roleLabel}
          {person.email ? ` · ${person.email}` : ' · no email on file'}
          {person.phone ? ` · ${person.phone}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Select
          value={level}
          disabled={pending}
          onValueChange={(v) => {
            const next = v as AlertLevel
            setLevel(next)
            save({ level: next })
          }}
        >
          <SelectTrigger className="w-[190px]" aria-label={`What ${person.name} is told about`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                <span className="font-medium">{l.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{l.hint}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Mail className={quiet ? 'size-3.5 text-muted-foreground/40' : 'size-3.5 text-muted-foreground'} />
            <Label htmlFor={`email-${person.id}`} className="text-xs">
              Email
            </Label>
            <Switch
              id={`email-${person.id}`}
              checked={email && !quiet}
              disabled={pending || quiet || !person.email}
              onCheckedChange={(next) => {
                setEmail(next)
                save({ email: next })
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <MessageSquare className={quiet ? 'size-3.5 text-muted-foreground/40' : 'size-3.5 text-muted-foreground'} />
            <Label htmlFor={`sms-${person.id}`} className="text-xs">
              SMS
            </Label>
            <Switch
              id={`sms-${person.id}`}
              checked={sms && !quiet}
              disabled={pending || quiet || !person.phone}
              onCheckedChange={(next) => {
                setSms(next)
                save({ sms: next })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
