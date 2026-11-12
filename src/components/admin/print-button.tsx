'use client'

import { Printer } from 'lucide-react'

/** Print the current page — the admin print stylesheet strips the shell. */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-sm font-medium transition hover:bg-black/5 print:hidden"
    >
      <Printer className="size-4" />
      {label}
    </button>
  )
}
