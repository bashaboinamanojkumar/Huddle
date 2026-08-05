import type {
  NotificationGroups,
  NotificationItem,
  UnreadCounts,
} from "@/lib/notifications/types"

const UNSAFE_PERCENT_ENCODING = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f|25)/i
const DOT_SEGMENT = /\/(?:\.|%2e)(?:\.|%2e)?(?:\/|$|%2f)/i
const NOTIFICATION_FALLBACK_PATH = "/app/notifications"

function compareNotifications(left: NotificationItem, right: NotificationItem): number {
  const timeComparison = right.lastEventAt.localeCompare(left.lastEventAt)
  return timeComparison || right.id.localeCompare(left.id)
}

export function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort(compareNotifications)
}

export function reconcileNotification(
  current: NotificationItem[],
  incoming: NotificationItem,
): NotificationItem[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  byId.set(incoming.id, incoming)
  return sortNotifications([...byId.values()])
}

export function mergeNotificationPage(
  current: NotificationItem[],
  page: NotificationItem[],
): NotificationItem[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of page) byId.set(item.id, item)
  return sortNotifications([...byId.values()])
}

export function countUnread(items: NotificationItem[]): UnreadCounts {
  return items.reduce<UnreadCounts>((counts, item) => {
    if (item.readAt !== null) return counts
    counts.total += 1
    if (item.category === "chat") counts.chat += 1
    return counts
  }, { total: 0, chat: 0 })
}

export function groupNotifications(
  items: NotificationItem[],
  now = new Date(),
): NotificationGroups {
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const startThisWeek = new Date(startToday)
  startThisWeek.setDate(startThisWeek.getDate() - 6)

  return sortNotifications(items).reduce<NotificationGroups>((groups, item) => {
    const eventTime = new Date(item.lastEventAt)
    if (eventTime >= startToday) groups.today.push(item)
    else if (eventTime >= startThisWeek) groups.thisWeek.push(item)
    else groups.older.push(item)
    return groups
  }, { today: [], thisWeek: [], older: [] })
}

export function safeNotificationPath(candidate: string | null | undefined): string {
  if (!candidate || candidate.length < 4 || candidate.length > 2048) {
    return NOTIFICATION_FALLBACK_PATH
  }
  if (!/^\/app(?:$|[/?#])/.test(candidate)) return NOTIFICATION_FALLBACK_PATH
  if (candidate.startsWith("//") || candidate.includes("\\")) {
    return NOTIFICATION_FALLBACK_PATH
  }
  if ([...candidate].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 32 || code === 127
  })) return NOTIFICATION_FALLBACK_PATH

  const pathname = candidate.split(/[?#]/, 1)[0]
  if (pathname.includes("//")) return NOTIFICATION_FALLBACK_PATH
  if (UNSAFE_PERCENT_ENCODING.test(pathname)) return NOTIFICATION_FALLBACK_PATH
  if (DOT_SEGMENT.test(pathname)) return NOTIFICATION_FALLBACK_PATH
  return candidate
}
