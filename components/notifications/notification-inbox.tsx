"use client"

import { useRouter } from "next/navigation"
import { BellOff, LoaderCircle, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { NotificationRow } from "@/components/notifications/notification-row"
import { groupNotifications, safeNotificationPath } from "@/lib/notifications/model"
import { useNotifications } from "@/lib/notifications/notification-provider"
import type { NotificationItem } from "@/lib/notifications/types"
import type { NotificationStatus } from "@/lib/notifications/state"

interface NotificationInboxViewProps {
  items: NotificationItem[]
  status: NotificationStatus
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  now?: Date
  onRetry(): void
  onMarkAll(): void
  onLoadMore(): void
  onOpen(item: NotificationItem): void
}

export function NotificationInboxView({
  items,
  status,
  error,
  hasMore,
  loadingMore,
  now,
  onRetry,
  onMarkAll,
  onLoadMore,
  onOpen,
}: NotificationInboxViewProps) {
  const groups = groupNotifications(items, now)
  const unread = items.some((item) => item.readAt === null)

  if (status === "loading" || status === "idle") {
    return (
      <div role="status" className="flex min-h-[45vh] items-center justify-center gap-3 text-sm text-white/54">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        Loading notifications
      </div>
    )
  }

  if (status === "error" && items.length === 0) {
    return (
      <div className="glass-card rounded-[2rem] p-6 text-center">
        <RotateCcw className="mx-auto h-8 w-8 text-coral" aria-hidden="true" />
        <h2 className="mt-4 font-heading text-lg font-bold text-white">Notifications are unavailable</h2>
        <p className="mt-2 text-sm text-white/56">{error}</p>
        <button type="button" onClick={onRetry} className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black">
          Try again
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="glass-card rounded-[2rem] p-7 text-center">
        <BellOff className="mx-auto h-9 w-9 text-white/40" aria-hidden="true" />
        <h2 className="mt-4 font-heading text-lg font-bold text-white">You’re all caught up</h2>
        <p className="mt-2 text-sm text-white/54">New Huddle updates will appear here.</p>
      </div>
    )
  }

  const sections = [
    { label: "Today", items: groups.today },
    { label: "This week", items: groups.thisWeek },
    { label: "Older", items: groups.older },
  ]

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {unread && (
          <button type="button" onClick={onMarkAll} className="text-xs font-bold text-secondary">
            Mark all read
          </button>
        )}
      </div>
      <div className="space-y-6">
        {sections.map((section) => section.items.length > 0 && (
          <section key={section.label} aria-labelledby={`notification-${section.label.replace(" ", "-").toLowerCase()}`}>
            <h2 id={`notification-${section.label.replace(" ", "-").toLowerCase()}`} className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/44">
              {section.label}
            </h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <NotificationRow key={item.id} item={item} onOpen={onOpen} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {error && <p className="mt-5 text-center text-xs text-coral">{error}</p>}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-6 w-full rounded-2xl bg-white/8 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  )
}

export function NotificationInbox() {
  const router = useRouter()
  const notifications = useNotifications()

  const open = async (item: NotificationItem) => {
    try {
      await notifications.markRead(item.id)
    } catch {
      toast.error("Could not update the read state.")
    } finally {
      router.push(safeNotificationPath(item.path))
    }
  }

  return (
    <NotificationInboxView
      {...notifications}
      onRetry={notifications.retry}
      onMarkAll={() => void notifications.markAllRead().catch(() => {
        toast.error("Could not mark notifications read.")
      })}
      onLoadMore={() => void notifications.loadMore()}
      onOpen={(item) => void open(item)}
    />
  )
}
