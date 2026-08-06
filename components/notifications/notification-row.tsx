"use client"

import {
  BellRing,
  CalendarClock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"
import type { NotificationCategory, NotificationItem } from "@/lib/notifications/types"
import { cn } from "@/lib/utils"

const categoryPresentation: Record<NotificationCategory, {
  label: string
  icon: typeof BellRing
}> = {
  chat: { label: "Chat", icon: MessageCircle },
  activities: { label: "Activity", icon: Users },
  reminders: { label: "Reminder", icon: CalendarClock },
  social: { label: "Social", icon: Users },
  safety: { label: "Safety", icon: ShieldCheck },
  digest: { label: "Digest", icon: Sparkles },
  rewards: { label: "Huddle", icon: BellRing },
}

export function NotificationRow({
  item,
  onOpen,
}: {
  item: NotificationItem
  onOpen(item: NotificationItem): void
}) {
  const presentation = categoryPresentation[item.category]
  const Icon = presentation.icon

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "flex w-full gap-3 rounded-3xl border p-4 text-left transition-colors",
        item.readAt === null
          ? "border-secondary/20 bg-secondary/8"
          : "border-white/8 bg-white/[0.035]",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-secondary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">
            {presentation.label}
          </span>
          <time className="text-[10px] text-white/38" dateTime={item.lastEventAt}>
            {new Date(item.lastEventAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        </span>
        <span className="mt-1 block text-sm font-bold text-white">{item.title}</span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-white/56">
          {item.body}
        </span>
        {item.readAt === null && (
          <span className="sr-only">Unread notification</span>
        )}
      </span>
    </button>
  )
}

