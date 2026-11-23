'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'

/**
 * The invitation link, for passing on by WhatsApp when email is slow or
 * lands in spam. It is shown once, right after it is made, and never stored
 * anywhere it could be read back.
 */
export function InviteLink({ link, emailed }: { link: string; emailed: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the link is selectable below.
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
      <p className="text-xs text-muted-foreground">
        {emailed
          ? 'If the email does not arrive, send them this link instead. It works once and expires in 7 days.'
          : 'Send them this link. It works once and expires in 7 days.'}
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1.5 font-mono text-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          <span className="ml-1.5">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
    </div>
  )
}
