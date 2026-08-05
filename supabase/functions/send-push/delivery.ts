export const PUSH_CATEGORIES = [
  "chat",
  "activities",
  "reminders",
  "social",
  "safety",
  "digest",
  "rewards",
] as const

export type PushCategory = (typeof PUSH_CATEGORIES)[number]
export type PushResultClassification = "sent" | "disable" | "retry" | "permanent"

export interface PushPayloadInput {
  notificationId: string
  category: PushCategory
  path: string
  unreadCount: number
}

export interface PushPayload {
  notificationId: string
  category: PushCategory
  path: string
  tag: string
  unreadCount: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ENCODED_UNSAFE_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f|25)/i
const DOT_SEGMENT_PATTERN = /\/(?:\.|%2e)(?:\.|%2e)?(?:\/|$|%2f)/i

export function isSafeApplicationPath(path: string): boolean {
  if (path.length < 4 || path.length > 2048) return false
  if (!/^\/app(?:$|[/?#])/.test(path)) return false
  if (path.startsWith("//") || path.includes("\\") || /[\u0000-\u0020\u007f]/.test(path)) return false

  const pathname = path.split(/[?#]/, 1)[0]
  if (pathname.includes("//")) return false
  if (ENCODED_UNSAFE_PATTERN.test(pathname)) return false
  if (DOT_SEGMENT_PATTERN.test(pathname)) return false

  return true
}

export function buildPushPayload(input: PushPayloadInput): PushPayload {
  if (!UUID_PATTERN.test(input.notificationId)) {
    throw new TypeError("Invalid notification ID")
  }
  if (!PUSH_CATEGORIES.includes(input.category)) {
    throw new TypeError("Invalid notification category")
  }
  if (!isSafeApplicationPath(input.path)) {
    throw new TypeError("Unsafe notification path")
  }
  if (!Number.isInteger(input.unreadCount) || input.unreadCount < 0) {
    throw new TypeError("Invalid unread count")
  }

  return {
    notificationId: input.notificationId,
    category: input.category,
    path: input.path,
    tag: `huddle-${input.notificationId}`,
    unreadCount: Math.min(input.unreadCount, 999),
  }
}

export function classifyPushResult(status: number | null): PushResultClassification {
  if (status !== null && status >= 200 && status <= 299) return "sent"
  if (status === 404 || status === 410) return "disable"
  if (status === null || status === 429 || (status >= 500 && status <= 599)) return "retry"
  return "permanent"
}

export function retryDelaySeconds(attempt: number): number {
  if (attempt <= 1) return 60
  if (attempt === 2) return 300
  if (attempt === 3) return 900
  return 3600
}

