import { describe, expect, it } from "vitest"
import {
  PUSH_DISMISSED_UNTIL_KEY,
  PUSH_RSVP_ELIGIBLE_AT_KEY,
  base64UrlToUint8Array,
  buildSubscriptionInput,
  decidePushPrompt,
  recordRsvpPushEligibility,
} from "@/lib/notifications/push"

describe("push prompt decisions", () => {
  const eligible = {
    supported: true,
    permission: "default" as NotificationPermission,
    rsvpEligibleAt: "2026-08-05T12:00:00.000Z",
    dismissedUntil: null,
    isIos: false,
    isStandalone: false,
    now: new Date("2026-08-05T13:00:00.000Z"),
  }

  it("hides unsupported, pre-RSVP, granted, and cooling-down prompts", () => {
    expect(decidePushPrompt({ ...eligible, supported: false })).toBe("hidden")
    expect(decidePushPrompt({ ...eligible, rsvpEligibleAt: null })).toBe("hidden")
    expect(decidePushPrompt({ ...eligible, permission: "granted" })).toBe("hidden")
    expect(decidePushPrompt({
      ...eligible,
      dismissedUntil: "2026-08-19T13:00:00.000Z",
    })).toBe("hidden")
  })

  it("shows browser-denied guidance without requesting again", () => {
    expect(decidePushPrompt({ ...eligible, permission: "denied" })).toBe("denied")
  })

  it("requires installation before offering Push on iOS", () => {
    expect(decidePushPrompt({ ...eligible, isIos: true, isStandalone: false }))
      .toBe("install")
    expect(decidePushPrompt({ ...eligible, isIos: true, isStandalone: true }))
      .toBe("explain")
  })

  it("offers Push in supported non-iOS browsers after the first RSVP", () => {
    expect(decidePushPrompt(eligible)).toBe("explain")
  })
})

describe("push subscription helpers", () => {
  it("converts an unpadded base64url VAPID key", () => {
    expect([...base64UrlToUint8Array("AQID-v8")]).toEqual([1, 2, 3, 250, 255])
  })

  it("builds the narrow subscription persistence payload", () => {
    const input = buildSubscriptionInput({
      endpoint: "https://push.example.com/subscriptions/one",
      toJSON: () => ({
        endpoint: "https://push.example.com/subscriptions/one",
        keys: { p256dh: "public-key", auth: "auth-secret" },
      }),
    }, "Browser summary")
    expect(input).toEqual({
      endpoint: "https://push.example.com/subscriptions/one",
      p256dh: "public-key",
      auth: "auth-secret",
      userAgent: "Browser summary",
    })
  })

  it("records only the first successful going RSVP", () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    recordRsvpPushEligibility(storage, new Date("2026-08-05T12:00:00.000Z"))
    recordRsvpPushEligibility(storage, new Date("2026-08-06T12:00:00.000Z"))

    expect(values.get(PUSH_RSVP_ELIGIBLE_AT_KEY)).toBe("2026-08-05T12:00:00.000Z")
    expect(values.has(PUSH_DISMISSED_UNTIL_KEY)).toBe(false)
  })
})

