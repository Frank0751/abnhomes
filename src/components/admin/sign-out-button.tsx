'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-muted-foreground hover:text-foreground"
      onClick={() => signOut({ callbackUrl: '/signin' })}
    >
      <LogOut className="size-4" />
      <span className="sr-only">Sign out</span>
    </Button>
  )
}
