import { describe, expect, it } from "vitest"
import {
  mergeActivities,
  mergeFlags,
  mergeFriends,
  mergeMessages,
  mergeProfiles,
  mergeReports,
  mergeRsvp,
  removeFriend,
  removeRsvp,
} from "@/lib/store/huddle-state"
import type { HuddleState } from "@/lib/types/huddle"

const state: HuddleState = {
  session: null,
  profiles: [{
    userId: "user-1",
    displayName: "Ada",
    firstName: "Ada",
    lastInitial: "L",
    status: "masters",
    interests: ["study"],
    availabilityBlocks: ["weekday_evening"],
    comfortSize: "medium",
    safetyPreference: "none",
    photoColor: "#111111",
    points: 10,
    streakDays: 1,
    meetupsThisWeek: 1,
    completedOnboarding: true,
  }],
  locations: [],
  activities: [{
    id: "activity-1",
    title: "Coffee",
    description: "Meet up",
    category: "coffee",
    locationId: "location-1",
    hostId: "user-1",
    capacity: 4,
    startTime: "2026-08-17T12:00:00.000Z",
    availabilityBlock: "weekday_afternoon",
    source: "user",
    status: "approved",
    universityId: "umd",
    cohort: "umd-pilot",
    comfortSize: "medium",
    safetyPreference: "none",
    createdAt: "2026-08-01T00:00:00.000Z",
  }],
  rsvps: [{
    activityId: "activity-1",
    userId: "user-1",
    status: "going",
    timestamp: "2026-08-01T00:00:00.000Z",
  }],
  messages: [{
    id: "message-1",
    activityId: "activity-1",
    userId: "user-1",
    body: "Hello",
    createdAt: "2026-08-01T00:00:00.000Z",
    flagged: false,
  }],
  flags: [{
    id: "flag-1",
    type: "chat",
    refId: "message-1",
    reason: "Review",
    status: "open",
    createdAt: "2026-08-01T00:00:00.000Z",
  }],
  reports: [{
    id: "report-1",
    reporterId: "user-1",
    context: "Review report",
    status: "open",
    createdAt: "2026-08-01T00:00:00.000Z",
  }],
  pulses: [],
  friends: [
    {
      id: "connection-1",
      userId: "user-1",
      friendId: "user-2",
      status: "pending",
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "connection-2",
      userId: "user-1",
      friendId: "user-3",
      status: "accepted",
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ],
}

describe("focused Huddle state reconciliation", () => {
  it("replaces records by stable key without duplicating them", () => {
    const changedProfile = { ...state.profiles[0], displayName: "Ada L." }
    const changedActivity = { ...state.activities[0], title: "Updated coffee" }
    const changedMessage = { ...state.messages[0], body: "Updated" }
    const changedFlag = { ...state.flags[0], status: "warned" as const }
    const changedReport = { ...state.reports[0], status: "dismissed" as const }
    const changedFriend = { ...state.friends[0], status: "accepted" as const }

    expect(mergeProfiles(state, changedProfile).profiles).toEqual([changedProfile])
    expect(mergeActivities(state, changedActivity).activities).toEqual([changedActivity])
    expect(mergeMessages(state, changedMessage).messages).toEqual([changedMessage])
    expect(mergeFlags(state, changedFlag).flags).toEqual([changedFlag])
    expect(mergeReports(state, changedReport).reports).toEqual([changedReport])
    expect(mergeFriends(state, changedFriend).friends).toEqual([
      changedFriend,
      state.friends[1],
    ])
  })

  it("adds or removes only the selected user's RSVP", () => {
    const changedRsvp = { ...state.rsvps[0], status: "waitlisted" as const }

    expect(mergeRsvp(state, changedRsvp).rsvps).toContainEqual(changedRsvp)
    expect(removeRsvp(state, changedRsvp.activityId, changedRsvp.userId).rsvps)
      .not.toContainEqual(expect.objectContaining({
        activityId: changedRsvp.activityId,
        userId: changedRsvp.userId,
      }))
  })

  it("removes one connection without touching unrelated connections", () => {
    const next = removeFriend(state, "connection-1")
    expect(next.friends.map(({ id }) => id)).toEqual(["connection-2"])
  })
})
