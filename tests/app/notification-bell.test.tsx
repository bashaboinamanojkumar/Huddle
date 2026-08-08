import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { NotificationBellView } from "@/components/notifications/notification-bell"

describe("notification bell", () => {
  it("links to the inbox and hides the badge when there are no unread notifications", () => {
    const html = renderToStaticMarkup(<NotificationBellView unreadCount={0} />)

    expect(html).toContain('href="/app/notifications"')
    expect(html).toContain('aria-label="Notifications, 0 unread"')
    expect(html).toContain("h-12 w-12")
    expect(html).not.toContain("<span")
  })

  it("shows the unread count and preserves the exact accessible label", () => {
    const html = renderToStaticMarkup(<NotificationBellView unreadCount={7} />)

    expect(html).toContain('href="/app/notifications"')
    expect(html).toContain('aria-label="Notifications, 7 unread"')
    expect(html).toContain(">7</span>")
  })

  it("caps only the visible badge at 99+", () => {
    const html = renderToStaticMarkup(<NotificationBellView unreadCount={120} />)

    expect(html).toContain('aria-label="Notifications, 120 unread"')
    expect(html).toContain(">99+</span>")
  })
})
