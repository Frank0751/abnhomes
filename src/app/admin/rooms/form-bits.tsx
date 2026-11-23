/**
 * Small pieces shared by the new-room and edit-room forms.
 *
 * Native <select> rather than the Radix one: these forms post as plain
 * FormData to server actions, and a native control submits its value with no
 * hidden-input bridging and works before any JavaScript has loaded.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export const TYPE_LABELS = {
  STUDIO: 'Studio',
  ONE_BED: 'One bedroom',
  TWO_BED: 'Two bedrooms',
  THREE_BED: 'Three bedrooms',
  FOUR_BED: 'Four bedrooms',
  PENTHOUSE: 'Penthouse',
  TOWNHOUSE: 'Townhouse',
  DETACHED: 'Detached house',
  COMMERCIAL: 'Commercial',
} as const

export const MODE_LABELS = {
  SHORT_STAY: 'Short stays (nightly)',
  LONG_LET: 'Long lets (monthly rent)',
  BOTH: 'Both',
} as const

export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export function FormField({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** A heading inside a long form, so it reads as sections rather than a wall of inputs. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="space-y-4 border-t border-border px-4 py-5 first:border-t-0 sm:px-5">
      <legend className="sr-only">{title}</legend>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </fieldset>
  )
}
