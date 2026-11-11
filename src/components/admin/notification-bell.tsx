'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

type Item = {
  id: string
  category: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

/**
 * The staff notification bell. Polls the feed every minute — good enough for
 * an operations desk and kinder to the battery than a websocket.
 */
export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as { items: Item[]; unread: number }
      setItems(json.items)
      setUnread(json.unread)
    } catch {
      // offline or logged out — the bell simply stays quiet
    }
  }, [])

  useEffect(() => {
    load()
    timer.current = setInterval(load, 60_000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [load])

  const markAll = async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setUnread(0)
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-[#5b6472] transition hover:bg-black/5 hover:text-[#0a0e1a]"
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ''}`}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#0d9488] text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-black/8 bg-white shadow-lifted">
            <div className="flex items-center justify-between border-b border-black/8 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5b6472]">Notifications</span>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs font-medium text-[#0d9488] hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-[#8a93a5]">Nothing yet — quiet day.</p>
              )}
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.link ?? '#'}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block border-b border-black/5 px-4 py-3 transition last:border-0 hover:bg-[#faf8f3]',
                    !item.readAt && 'bg-[#0d9488]/[0.05]'
                  )}
                >
                  <p className={cn('text-sm', !item.readAt ? 'font-semibold text-[#0a0e1a]' : 'text-[#3a4354]')}>
                    {item.title}
                  </p>
                  {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-[#5b6472]">{item.body}</p>}
                  <p className="mt-1 text-[11px] text-[#8a93a5]">
                    {new Date(item.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
