'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toggleWishlistAction } from './wishlist-actions'

/** Save-to-wishlist heart. Guests who are not signed in are sent to sign-in. */
export function WishlistButton({ unitId, initiallySaved }: { unitId: string; initiallySaved: boolean }) {
  const [saved, setSaved] = useState(initiallySaved)
  const [pending, start] = useTransition()
  const router = useRouter()

  const toggle = () =>
    start(async () => {
      const result = await toggleWishlistAction(unitId)
      if (result.authRequired) {
        router.push('/signin?callbackUrl=' + encodeURIComponent(window.location.pathname))
        return
      }
      setSaved(result.saved)
    })

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? 'Remove from saved homes' : 'Save this home'}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        saved
          ? 'border-[#0d9488] bg-[#0d9488]/[0.08] text-[#0d9488]'
          : 'border-black/12 bg-white/90 text-foreground/70 hover:border-black/25'
      }`}
    >
      <Heart className={`size-3.5 ${saved ? 'fill-[#0d9488]' : ''}`} />
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}
