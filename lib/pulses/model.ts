import type { PulseResponseView } from "@/lib/types/huddle"

export type PulsePageStatus =
  | "loading"
  | "ineligible"
  | "unanswered"
  | "submitting"
  | "stored"
  | "error"

const COPY: Record<PulsePageStatus, string> = {
  loading: "Loading your private response…",
  ineligible: "This private pulse is only available to people who joined this Huddle.",
  unanswered: "Did you meet up with your Huddle?",
  submitting: "Saving your response…",
  stored: "Your response is saved and cannot be edited.",
  error: "We could not load your private response.",
}

export function pulseStateCopy(status: PulsePageStatus): string {
  return COPY[status]
}

export function validatePulseRating(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("Pulse rating must be an integer between 1 and 5 or left blank.")
  }
  return value
}

export function canSubmitPulse(response: PulseResponseView | null): boolean {
  return response === null
}
