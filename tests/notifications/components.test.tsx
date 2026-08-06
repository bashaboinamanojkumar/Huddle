import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import {
  NotificationInboxView,
} from "@/components/notifications/notification-inbox"
import { NotificationRow } from "@/components/notifications/notification-row"
import {
  NotificationSettingsView,
} from "@/components/notifications/notification-settings"
import {
  NotificationOperationsPanel,
  parseNotificationOperations,
} from "@/components/notifications/notification-operations"
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationRuntimeConfig,
} from "@/lib/notifications/types"

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    userId: "10000000-0000-4000-8000-000000000001",
    type: "chat_message",
    category: "chat",
    title: "New Huddle message",
    body: "A new message is ready in your inbox.",
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

const preferences: NotificationPreferences = {
  userId: "10000000-0000-4000-8000-000000000001",
  pushEnabled: true,
  chatEnabled: true,
  activitiesEnabled: true,
  remindersEnabled: true,
  socialEnabled: true,
  safetyEnabled: true,
  digestEnabled: false,
  rewardsEnabled: false,
  quietHoursStart: "22:00:00",
  quietHoursEnd: "08:00:00",
  timezone: "America/New_York",
  dailyPushCap: 6,
  updatedAt: "2026-08-05T12:00:00.000Z",
}

const runtime: NotificationRuntimeConfig = {
  notificationCoreEnabled: true,
  pushEnabled: true,
  rewardsEnabled: false,
  pushRolloutPercentage: 0,
}

describe("notification inbox views", () => {
  it("renders grouped headings, unread state, and mark-all", () => {
    const html = renderToStaticMarkup(
      <NotificationInboxView
        items={[
          item(),
          item({
            id: "week",
            category: "social",
            type: "friend_request",
            lastEventAt: "2026-08-01T12:00:00.000Z",
          }),
        ]}
        status="ready"
        error={null}
        hasMore={false}
        loadingMore={false}
        now={new Date("2026-08-05T16:00:00.000Z")}
        onRetry={vi.fn()}
        onMarkAll={vi.fn()}
        onLoadMore={vi.fn()}
        onOpen={vi.fn()}
      />,
    )
    expect(html).toContain("Today")
    expect(html).toContain("This week")
    expect(html).toContain("Unread notification")
    expect(html).toContain("Mark all read")
    expect(html).toContain("Social")
  })

  it("renders loading, empty, and retryable error states", () => {
    const base = {
      items: [],
      hasMore: false,
      loadingMore: false,
      now: new Date("2026-08-05T16:00:00.000Z"),
      onRetry: vi.fn(),
      onMarkAll: vi.fn(),
      onLoadMore: vi.fn(),
      onOpen: vi.fn(),
    }
    expect(renderToStaticMarkup(
      <NotificationInboxView {...base} status="loading" error={null} />,
    )).toContain("Loading notifications")
    expect(renderToStaticMarkup(
      <NotificationInboxView {...base} status="ready" error={null} />,
    )).toContain("You’re all caught up")
    const error = renderToStaticMarkup(
      <NotificationInboxView {...base} status="error" error="Offline" />,
    )
    expect(error).toContain("Offline")
    expect(error).toContain("Try again")
  })

  it("renders category and read status for one row", () => {
    const html = renderToStaticMarkup(
      <NotificationRow item={item({ category: "safety" })} onOpen={vi.fn()} />,
    )
    expect(html).toContain("Safety")
    expect(html).toContain("Unread notification")
  })
})

describe("notification settings", () => {
  it("shows production defaults and a current-device control without rewards", () => {
    const html = renderToStaticMarkup(
      <NotificationSettingsView
        preferences={preferences}
        runtime={runtime}
        saving={false}
        saved={false}
        error={null}
        currentDeviceEnabled={false}
        deviceControlAvailable={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onEnableDevice={vi.fn()}
        onDisableDevice={vi.fn()}
      />,
    )
    expect(html).toContain("10:00 PM–8:00 AM")
    expect(html).toContain("6 per day")
    expect(html).toContain("Current device")
    expect(html).not.toContain("Reward notifications")
  })

  it("explains when the runtime push kill switch is active", () => {
    const html = renderToStaticMarkup(
      <NotificationSettingsView
        preferences={preferences}
        runtime={{ ...runtime, pushEnabled: false }}
        saving={false}
        saved={false}
        error={null}
        currentDeviceEnabled={false}
        deviceControlAvailable={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onEnableDevice={vi.fn()}
        onDisableDevice={vi.fn()}
      />,
    )
    expect(html).toContain("Push is temporarily paused")
  })
})

describe("notification operations", () => {
  it("parses and renders aggregates without private fields", () => {
    const summary = parseNotificationOperations({
      opted_in_users: 10,
      active_subscriptions: 12,
      disabled_subscriptions: 2,
      pending_deliveries: 3,
      due_deliveries: 1,
      processing_deliveries: 1,
      sent_deliveries: 100,
      failed_deliveries: 4,
      retry_deliveries: 2,
      recent_errors: [{ category: "chat", code: "http_410", count: 2 }],
      endpoint: "must-not-render",
      body: "must-not-render",
    })
    const html = renderToStaticMarkup(<NotificationOperationsPanel summary={summary} />)
    expect(html).toContain("Active subscriptions")
    expect(html).toContain("http_410")
    expect(html).not.toContain("must-not-render")
  })
})

