'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardList,
  Coins,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  Sparkles,
  Star,
  Tag,
  TriangleAlert,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABELS, type Permission } from '@/lib/rbac'
import type { Role } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/admin/notification-bell'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission?: Permission
  exact?: boolean
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Today',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
      { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays, permission: 'bookings:read' },
      { href: '/admin/bookings', label: 'Bookings', icon: BedDouble, permission: 'bookings:read' },
      {
        href: '/admin/housekeeping',
        label: 'Housekeeping',
        icon: Sparkles,
        permission: 'housekeeping:read',
      },
    ],
  },
  {
    group: 'Marketplace',
    items: [
      { href: '/admin/reviews', label: 'Reviews', icon: Star, permission: 'reviews:moderate' },
      { href: '/admin/promotions', label: 'Promotions', icon: Tag, permission: 'promotions:manage' },
    ],
  },
  {
    group: 'Tenancies',
    items: [
      { href: '/admin/leases', label: 'Leases', icon: FileText, permission: 'leases:read' },
      { href: '/admin/arrears', label: 'Arrears', icon: TriangleAlert, permission: 'money:read' },
    ],
  },
  {
    group: 'Money',
    items: [
      { href: '/admin/money', label: 'Payments', icon: Coins, permission: 'money:read' },
      { href: '/admin/expenses', label: 'Expenses', icon: ReceiptText, permission: 'money:record' },
      { href: '/admin/owners', label: 'Owner statements', icon: ClipboardList, permission: 'owners:read' },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'reports:read' },
    ],
  },
  {
    group: 'Buildings',
    items: [
      { href: '/admin/maintenance', label: 'Maintenance', icon: Wrench, permission: 'maintenance:read' },
      { href: '/admin/assets', label: 'Assets & servicing', icon: Package, permission: 'maintenance:manage' },
      { href: '/admin/portfolio', label: 'Portfolio', icon: Building2, permission: 'units:read' },
      { href: '/admin/settings', label: 'Settings', icon: Settings, permission: 'settings:write' },
    ],
  },
  {
    group: 'Platform',
    items: [
      { href: '/admin/messages', label: 'Messages', icon: MessageSquare, permission: 'settings:write' },
      { href: '/admin/users', label: 'Users', icon: Users, permission: 'users:manage' },
      { href: '/admin/audit', label: 'Audit log', icon: ScrollText, permission: 'audit:read' },
    ],
  },
]

export function AdminShell({
  children,
  user,
  permissions,
}: {
  children: React.ReactNode
  user: { name: string; role: Role; scopeLabel: string }
  permissions: Permission[]
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const allowed = (item: NavItem) => !item.permission || permissions.includes(item.permission)

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter(
    (g) => g.items.length > 0
  )

  return (
    <div className="min-h-dvh bg-[#f7f5f0] text-foreground">
      {/* Mobile bar. Staff on site are on a phone, not a laptop. */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-black/8 bg-[#faf8f3]/95 px-4 py-3 backdrop-blur">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/images/logo/abn-badge.png" alt="" width={26} height={26} />
          <span className="font-serif text-sm">ABN Operations</span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded p-2 hover:bg-black/5"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside
          className={cn(
            'border-r border-black/8 bg-[#faf8f3] lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto',
            open ? 'block' : 'hidden lg:block'
          )}
        >
          <div className="hidden lg:flex items-center gap-2.5 px-5 py-5">
            <Image src="/images/logo/abn-badge.png" alt="" width={30} height={30} />
            <div className="leading-tight">
              <p className="font-serif text-sm tracking-tight">ABN Homes</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Operations
              </p>
            </div>
          </div>

          <nav className="px-3 pb-6 lg:pt-1 pt-3">
            {groups.map((group) => (
              <div key={group.group} className="mb-5">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                  {group.group}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href)
                    const Icon = item.icon

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground/75 hover:bg-black/5 hover:text-foreground'
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-black/8 px-5 py-4">
            <p className="text-[13px] font-medium leading-tight">{user.name}</p>
            <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{user.scopeLabel}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 h-8 w-full justify-start px-2 text-[13px] text-muted-foreground hover:text-foreground"
              onClick={() => signOut({ callbackUrl: '/signin' })}
            >
              <LogOut className="mr-2 size-3.5" />
              Sign out
            </Button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-end border-b border-black/8 bg-[#f7f5f0]/85 px-4 py-2 backdrop-blur sm:px-8">
            <NotificationBell />
          </header>
          <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-10">{children}</main>
        </div>
      </div>
    </div>
  )
}
