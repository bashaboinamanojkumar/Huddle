import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AppHeaderView } from "@/components/app/app-header"
import { FeedHero } from "@/components/app/feed-hero"

describe("unified app header", () => {
  it("renders one Huddle brand with notification and profile actions", () => {
    const html = renderToStaticMarkup(
      <AppHeaderView
        unreadCount={2}
        profileInitial="M"
        profileColor="#d75b49"
      />,
    )

    expect(html.match(/>Huddle</gu)).toHaveLength(1)
    expect(html).toContain('aria-label="Notifications, 2 unread"')
    expect(html).toContain('href="/app/profile"')
    expect(html).toContain('aria-label="Open profile"')
    expect(html).toContain('background-color:#d75b49')
    expect(html).toContain(">M</a>")
  })

  it("caps the visible unread badge at 99+", () => {
    const html = renderToStaticMarkup(
      <AppHeaderView
        unreadCount={120}
        profileInitial="M"
        profileColor="#d75b49"
      />,
    )

    expect(html).toContain('aria-label="Notifications, 120 unread"')
    expect(html).toContain(">99+</span>")
  })
})

describe("feed hero", () => {
  it("renders the greeting and three statistics without duplicate branding", () => {
    const html = renderToStaticMarkup(
      <FeedHero
        firstName="Manoj7"
        attendingCount={1}
        streakDays={0}
        points={0}
      />,
    )

    expect(html).toContain("Hey, Manoj7")
    expect(html).toContain("Good to see you. Here&#x27;s what&#x27;s happening.")
    expect(html).toContain("attending")
    expect(html).toContain("day streak")
    expect(html).toContain("points")
    expect(html).not.toContain("huddle-icon")
    expect(html).not.toMatch(/>huddle</u)
    expect(html).not.toContain("safe-pt")
  })
})
