'use client'

import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'

/**
 * Opens the browser's own print dialog, where "Save as PDF" is a destination.
 * A page cannot hand someone a file directly, so this is the route that
 * actually works on a phone as well as a desktop.
 */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer className="mr-1.5 size-4" />
      Print or save as PDF
    </Button>
  )
}
