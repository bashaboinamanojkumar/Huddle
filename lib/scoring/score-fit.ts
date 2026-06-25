import type { Category, HuddleActivity, HuddleProfile } from "@/lib/types/huddle"

export interface FitScoreBreakdown {
  total: number
  interest: number
  availability: number
  comfort: number
  sharedInterests: Category[]
  blocked: boolean
  reason?: string
}

function overlaps<T>(a: T[], b: T[]): T[] {
  const set = new Set(a)
  return b.filter((item) => set.has(item))
}

export function scoreFit(profile: HuddleProfile, activity: HuddleActivity): FitScoreBreakdown {
  if (activity.safetyPreference === "women_only" && profile.safetyPreference !== "women_only") {
    return {
      total: -1,
      interest: 0,
      availability: 0,
      comfort: 0,
      sharedInterests: [],
      blocked: true,
      reason: "This activity is limited by a safety preference.",
    }
  }

  const sharedInterests = overlaps(profile.interests, [activity.category])
  const interest = sharedInterests.length > 0 ? 45 : 8
  const availability = profile.availabilityBlocks.includes(activity.availabilityBlock) ? 35 : 6
  const comfort =
    profile.comfortSize === "either" ||
    activity.comfortSize === "either" ||
    profile.comfortSize === activity.comfortSize
      ? 20
      : 5

  return {
    total: interest + availability + comfort,
    interest,
    availability,
    comfort,
    sharedInterests,
    blocked: false,
  }
}
