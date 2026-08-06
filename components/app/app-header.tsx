"use client"

import Link from "next/link"
import { Bell } from "lucide-react"
import { useNotifications } from "@/lib/notifications/notification-provider"

export function AppHeader() {
  const { unreadCount } = useNotifications()
  const visibleCount = unreadCount > 99 ? "99+" : String(unreadCount)

  return (
    <header className="safe-pt z-30 flex shrink-0 items-center justify-between border-b border-white/8 bg-black/72 px-5 pb-3 pt-3 backdrop-blur-xl">
      <Link href="/app" className="flex items-center gap-2" aria-label="Huddle home">
        <img src="/huddle-icon.png" alt="" className="h-8 w-8 object-contain" />
        <span className="font-heading text-sm font-black tracking-wide text-white">Huddle</span>
      </Link>
      <Link
        href="/app/notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-white"
        aria-label={`Notifications, ${unreadCount} unread`}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-black text-white">
            {visibleCount}
          </span>
        )}
      </Link>
    </header>
  )
}

