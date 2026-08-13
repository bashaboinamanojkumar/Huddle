export const PULL_THRESHOLD_PX = 72
export const MAX_PULL_DISTANCE_PX = 96
export const PULL_RESISTANCE = 0.5

interface PullStartInput {
  scrollTop: number
  touchCount: number
  refreshing: boolean
  interactiveTarget: boolean
}

interface PullMeasurementInput {
  deltaX: number
  deltaY: number
  touchCount: number
}

export interface PullMeasurement {
  cancelled: boolean
  distance: number
  armed: boolean
}

export function isPullStartEligible(input: PullStartInput): boolean {
  return input.scrollTop <= 0
    && input.touchCount === 1
    && !input.refreshing
    && !input.interactiveTarget
}

export function calculatePull(input: PullMeasurementInput): PullMeasurement {
  const verticalDistance = Math.max(0, input.deltaY)
  const cancelled = input.touchCount !== 1
    || input.deltaY < 0
    || Math.abs(input.deltaX) > verticalDistance

  if (cancelled) {
    return { cancelled: true, distance: 0, armed: false }
  }

  const distance = Math.min(
    MAX_PULL_DISTANCE_PX,
    verticalDistance * PULL_RESISTANCE,
  )

  return {
    cancelled: false,
    distance,
    armed: distance >= PULL_THRESHOLD_PX,
  }
}
