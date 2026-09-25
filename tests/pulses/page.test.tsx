import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { PulsePageView } from "@/app/app/activity/[id]/pulse/page"

const baseProps = {
  activityTitle: "Coffee Chat",
  status: "unanswered" as const,
  response: null,
  didMeet: null,
  rating: null,
  onDidMeetChange: vi.fn(),
  onRatingChange: vi.fn(),
  onSubmit: vi.fn(),
  onRetry: vi.fn(),
}

function render(overrides: Partial<React.ComponentProps<typeof PulsePageView>> = {}) {
  return renderToStaticMarkup(<PulsePageView {...baseProps} {...overrides} />)
}

describe("pulse response page states", () => {
  it("renders loading without submission controls", () => {
    const html = render({ status: "loading" })
    expect(html).toContain("Loading your private response")
    expect(html).not.toContain("Submit response")
  })

  it("renders ineligible without revealing another attendee response", () => {
    const html = render({ status: "ineligible" })
    expect(html).toContain("only available to people who joined")
    expect(html).not.toContain("Submit response")
  })

  it("renders unanswered yes, no, optional rating, and submit controls", () => {
    const html = render()
    expect(html).toContain("Did you meet up")
    expect(html).toContain("Yes")
    expect(html).toContain("No")
    expect(html).toContain("Optional rating")
    expect(html).toContain("Submit response")
  })

  it("disables the form while submitting", () => {
    const html = render({ status: "submitting", didMeet: true })
    expect(html).toContain("Saving your response")
    expect(html).toContain("disabled")
  })

  it("renders an immutable stored response", () => {
    const html = render({
      status: "stored",
      response: {
        activityId: "activity-1",
        didMeet: true,
        rating: 5,
        createdAt: "2026-08-04T12:00:00.000Z",
      },
    })
    expect(html).toContain("response is saved")
    expect(html).toContain("Yes, we met")
    expect(html).toContain("5/5")
    expect(html).not.toContain("Submit response")
  })

  it("renders a retry action after a private load failure", () => {
    const html = render({ status: "error" })
    expect(html).toContain("could not load")
    expect(html).toContain("Retry")
  })
})
