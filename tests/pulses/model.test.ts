import { describe, expect, it } from "vitest"
import {
  canSubmitPulse,
  pulseStateCopy,
  validatePulseRating,
} from "@/lib/pulses/model"

describe("pulse response model", () => {
  it.each([
    ["loading", "Loading your private response"],
    ["ineligible", "only available to people who joined"],
    ["unanswered", "Did you meet up"],
    ["submitting", "Saving your response"],
    ["stored", "response is saved"],
    ["error", "could not load"],
  ] as const)("provides safe copy for %s", (state, expected) => {
    expect(pulseStateCopy(state)).toContain(expected)
  })

  it.each([null, 1, 2, 3, 4, 5])("accepts rating %s", (rating) => {
    expect(validatePulseRating(rating)).toBe(rating)
  })

  it.each([0, 6, 1.5, Number.NaN, "5", undefined])(
    "rejects invalid rating %s",
    (rating) => {
      expect(() => validatePulseRating(rating)).toThrow("between 1 and 5")
    },
  )

  it("prevents editing after a response exists", () => {
    expect(canSubmitPulse(null)).toBe(true)
    expect(
      canSubmitPulse({
        activityId: "activity-1",
        didMeet: true,
        rating: 5,
        createdAt: "2026-08-04T12:00:00.000Z",
      }),
    ).toBe(false)
  })
})
