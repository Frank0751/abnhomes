'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Copies the public booking link so a member of staff can drop it into a
 * WhatsApp thread or an SMS. Anyone who books through it lands in the same
 * pipeline as a booking made on the website itself: a pending reservation
 * with the guest's name and phone, priced by the live rate plans.
 */
export function ShareBookingLinkButton() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    const url = `${window.location.origin}/book`
    let ok = false
    try {
      await navigator.clipboard.writeText(url)
      ok = true
    } catch {
      // Clipboard API needs a secure context; fall back for plain http.
      try {
        const input = document.createElement('textarea')
        input.value = url
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        ok = document.execCommand('copy')
        input.remove()
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} type="button">
      {copied ? (
        <Check className="mr-1.5 size-4 text-primary" />
      ) : (
        <Link2 className="mr-1.5 size-4" />
      )}
      {copied ? 'Link copied' : 'Copy booking link'}
    </Button>
  )
}
