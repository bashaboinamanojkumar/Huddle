import { describe, expect, it } from "vitest"
import {
  countUnread,
  groupNotifications,
  mergeNotificationPage,
  reconcileNotification,
  safeNotificationPath,
  sortNotifications,
} from "@/lib/notifications/model"
import type { NotificationItem } from "@/lib/notifications/types"
import {
  createNotificationState,
  notificationReducer,
  shouldShowArrivalToast,
} from "@/lib/notifications/state"

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    userId: "10000000-0000-4000-8000-000000000001",
    type: "chat_message",
    category: "chat",
    title: "New chat activity",
    body: "A new message is available.",
    path: "/app/chats/20000000-0000-4000-8000-000000000001",
    data: {},
    dedupeKey: "chat:one",
    readAt: null,
    seenAt: null,
    createdAt: "2026-08-05T12:00:00.000Z",
    lastEventAt: "2026-08-05T12:00:00.000Z",
    ...overrides,
  }
}

describe("notification ordering and reconciliation", () => {
  it("orders by last event and then id descending", () => {
    const result = sortNotifications([
      item({ id: "b", lastEventAt: "2026-08-05T10:00:00.000Z" }),
      item({ id: "a", lastEventAt: "2026-08-05T11:00:00.000Z" }),
      item({ id: "c", lastEventAt: "2026-08-05T11:00:00.000Z" }),
    ])
    expect(result.map(({ id }) => id)).toEqual(["c", "a", "b"])
  })

  it("deduplicates inserts by notification id", () => {
    const original = item()
    expect(reconcileNotification([original], original)).toHaveLength(1)
  })

  it("reopens and moves a coalesced update", () => {
    const original = item({ readAt: "2026-08-05T12:30:00.000Z" })
    const updated = item({
      readAt: null,
      lastEventAt: "2026-08-05T15:00:00.000Z",
      body: "Two new messages are available.",
    })
    const result = reconcileNotification([
      item({ id: "newer", lastEventAt: "2026-08-05T14:00:00.000Z" }),
      original,
    ], updated)

    expect(result[0]).toMatchObject({ id: updated.id, readAt: null, body: updated.body })
  })

  it("merges cursor pages without duplicate rows", () => {
    const first = item({ id: "a", lastEventAt: "2026-08-05T15:00:00.000Z" })
    const overlap = item({ id: "b", lastEventAt: "2026-08-05T14:00:00.000Z" })
    const older = item({ id: "c", lastEventAt: "2026-08-04T12:00:00.000Z" })
    expect(mergeNotificationPage([first, overlap], [overlap, older]).map(({ id }) => id))
      .toEqual(["a", "b", "c"])
  })
})

describe("notification presentation helpers", () => {
  it("counts all unread and unread chat independently", () => {
    expect(countUnread([
      item({ id: "chat", category: "chat" }),
      item({ id: "social", category: "social" }),
      item({ id: "read", readAt: "2026-08-05T13:00:00.000Z" }),
    ])).toEqual({ total: 2, chat: 1 })
  })

  it("groups today, the prior six days, and older notifications", () => {
    const groups = groupNotifications([
      item({ id: "today", lastEventAt: "2026-08-05T08:00:00.000Z" }),
      item({ id: "week", lastEventAt: "2026-08-01T08:00:00.000Z" }),
      item({ id: "older", lastEventAt: "2026-07-20T08:00:00.000Z" }),
    ], new Date("2026-08-05T16:00:00.000Z"))

    expect(groups.today.map(({ id }) => id)).toEqual(["today"])
    expect(groups.thisWeek.map(({ id }) => id)).toEqual(["week"])
    expect(groups.older.map(({ id }) => id)).toEqual(["older"])
  })

  it("allows only validated application deep links", () => {
    expect(safeNotificationPath("/app/activity/abc?tab=chat#latest"))
      .toBe("/app/activity/abc?tab=chat#latest")
    for (const unsafe of [
      "https://evil.example/app",
      "//evil.example/app",
      "/settings",
      "/app/../admin",
      "/app/%2e%2e/admin",
      "/app\\admin",
    ]) {
      expect(safeNotificationPath(unsafe)).toBe("/app/notifications")
    }
  })
})

describe("notification provider state", () => {
  it("tracks load, failure, and retry states", () => {
    const initial = createNotificationState("user-a")
    const loading = notificationReducer(initial, { type: "load_started" })
    const failed = notificationReducer(loading, {
      type: "load_failed",
      error: "Network unavailable",
    })
    const retrying = notificationReducer(failed, { type: "load_started" })

    expect(loading.status).toBe("loading")
    expect(failed).toMatchObject({ status: "error", error: "Network unavailable" })
    expect(retrying).toMatchObject({ status: "loading", error: null })
  })

  it("loads and exhausts cursor pages", () => {
    const first = item({ id: "a" })
    const loaded = notificationReducer(createNotificationState("user-a"), {
      type: "load_succeeded",
      items: [first],
      cursor: { id: first.id, lastEventAt: first.lastEventAt },
      hasMore: true,
    })
    const exhausted = notificationReducer(loaded, {
      type: "page_loaded",
      items: [item({ id: "b", lastEventAt: "2026-08-04T12:00:00.000Z" })],
      cursor: null,
      hasMore: false,
    })

    expect(exhausted.items.map(({ id }) => id)).toEqual(["a", "b"])
    expect(exhausted.hasMore).toBe(false)
    expect(exhausted.cursor).toBeNull()
  })

  it("optimistically reads one item and rolls back the exact snapshot", () => {
    const original = [item({ id: "a" }), item({ id: "b" })]
    const loaded = notificationReducer(createNotificationState("user-a"), {
      type: "load_succeeded",
      items: original,
      cursor: null,
      hasMore: false,
    })
    const optimistic = notificationReducer(loaded, {
      type: "read_optimistic",
      id: "a",
      at: "2026-08-05T16:00:00.000Z",
    })
    const rolledBack = notificationReducer(optimistic, { type: "rollback" })

    expect(optimistic.items.find(({ id }) => id === "a")?.readAt).not.toBeNull()
    expect(rolledBack.items).toEqual(original)
  })

  it("marks all loaded items read optimistically", () => {
    const loaded = notificationReducer(createNotificationState("user-a"), {
      type: "load_succeeded",
      items: [item({ id: "a" }), item({ id: "b" })],
      cursor: null,
      hasMore: false,
    })
    const optimistic = notificationReducer(loaded, {
      type: "all_read_optimistic",
      at: "2026-08-05T16:00:00.000Z",
    })
    expect(optimistic.items.every(({ readAt }) => readAt !== null)).toBe(true)
  })

  it("reconciles both inserts and coalescing updates", () => {
    const loaded = notificationReducer(createNotificationState("user-a"), {
      type: "load_succeeded",
      items: [item({ id: "a", readAt: "2026-08-05T13:00:00.000Z" })],
      cursor: null,
      hasMore: false,
    })
    const inserted = notificationReducer(loaded, {
      type: "notification_received",
      item: item({ id: "b", category: "social" }),
    })
    const updated = notificationReducer(inserted, {
      type: "notification_received",
      item: item({ id: "a", readAt: null, lastEventAt: "2026-08-05T17:00:00.000Z" }),
    })

    expect(updated.items.map(({ id }) => id)).toEqual(["a", "b"])
    expect(updated.items[0].readAt).toBeNull()
  })

  it("resets all user-owned state on an account switch", () => {
    const loaded = notificationReducer(createNotificationState("user-a"), {
      type: "load_succeeded",
      items: [item()],
      cursor: null,
      hasMore: false,
    })
    const reset = notificationReducer(loaded, { type: "user_reset", userId: "user-b" })
    expect(reset).toEqual(createNotificationState("user-b"))
  })

  it("suppresses arrival toasts when visible Push is granted", () => {
    expect(shouldShowArrivalToast("granted")).toBe(false)
    expect(shouldShowArrivalToast("default")).toBe(true)
    expect(shouldShowArrivalToast(undefined)).toBe(true)
  })
})
