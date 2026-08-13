import { describe, expect, it } from "vitest"
import {
  MAX_PULL_DISTANCE_PX,
  PULL_THRESHOLD_PX,
  calculatePull,
  isPullStartEligible,
} from "@/components/app/pull-to-refresh-model"

describe("pull-to-refresh gesture model", () => {
  it("starts only for one idle touch at the top outside interactive content", () => {
    expect(isPullStartEligible({
      scrollTop: 0,
      touchCount: 1,
      refreshing: false,
      interactiveTarget: false,
    })).toBe(true)

    expect(isPullStartEligible({
      scrollTop: 1,
      touchCount: 1,
      refreshing: false,
      interactiveTarget: false,
    })).toBe(false)
    expect(isPullStartEligible({
      scrollTop: 0,
      touchCount: 2,
      refreshing: false,
      interactiveTarget: false,
    })).toBe(false)
    expect(isPullStartEligible({
      scrollTop: 0,
      touchCount: 1,
      refreshing: true,
      interactiveTarget: false,
    })).toBe(false)
    expect(isPullStartEligible({
      scrollTop: 0,
      touchCount: 1,
      refreshing: false,
      interactiveTarget: true,
    })).toBe(false)
  })

  it("applies resistance, arms at the threshold, and caps travel", () => {
    expect(calculatePull({ deltaX: 0, deltaY: 100, touchCount: 1 })).toEqual({
      cancelled: false,
      distance: 50,
      armed: false,
    })
    expect(calculatePull({ deltaX: 0, deltaY: 144, touchCount: 1 })).toEqual({
      cancelled: false,
      distance: PULL_THRESHOLD_PX,
      armed: true,
    })
    expect(calculatePull({ deltaX: 0, deltaY: 1000, touchCount: 1 })).toEqual({
      cancelled: false,
      distance: MAX_PULL_DISTANCE_PX,
      armed: true,
    })
  })

  it("cancels upward, horizontal, and multitouch movement", () => {
    expect(calculatePull({ deltaX: 0, deltaY: -1, touchCount: 1 }).cancelled).toBe(true)
    expect(calculatePull({ deltaX: 60, deltaY: 30, touchCount: 1 }).cancelled).toBe(true)
    expect(calculatePull({ deltaX: 0, deltaY: 30, touchCount: 2 }).cancelled).toBe(true)
  })
})
