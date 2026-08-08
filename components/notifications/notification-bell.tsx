"use client"

import Link from "next/link"
import { Bell } from "lucide-react"
import { useNotifications } from "@/lib/notifications/notification-provider"

export interface NotificationBellViewProps {
  unreadCount: number
}

export function NotificationBellView({ unreadCount }: NotificationBellViewProps) {
  const visibleCount = unreadCount > 99 ? "99+" : String(unreadCount)

  return (
    <Link
      href="/app/notifications"
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/8 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      aria-label={`Notifications, ${unreadCount} unread`}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-black text-white">
          {visibleCount}
        </span>
      ) : null}
    </Link>
  )
}

export function NotificationBell() {
  const { unreadCount } = useNotifications()

  return <NotificationBellView unreadCount={unreadCount} />
}
