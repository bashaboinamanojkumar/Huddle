import { describe, expect, it } from "vitest"
import {
  SYSTEM_USER_ID,
  toChatMessage,
  toFriendConnection,
  toHuddleActivity,
  toHuddleProfile,
  toHuddleRsvp,
  toPulseResponseView,
  toSafetyFlag,
} from "@/lib/supabase/mappers"
import type {
  ActivityRow,
  FriendConnectionRow,
  MessageRow,
  PublicProfile,
  PulseRow,
  RsvpRow,
  SafetyFlagRow,
} from "@/lib/types/database"

function profileRow(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id: "8f14e45f-ceea-467a-9f5f-1c1c1c1c1c1c",
    first_name: "Ada",
    last_name: "",
    last_initial: "L",
    display_name: "Ada L.",
    username: null,
    avatar_url: null,
    bio: null,
    graduation_year: null,
    major: null,
    minor: null,
    is_verified: false,
    status: "masters",
    interests: ["study", "coffee"],
    availability_blocks: ["weekday_evening"],
    comfort_size: "medium",
    safety_preference: "none",
    photo_color: "#d05b47",
    points: 12,
    streak_days: 3,
    meetups_this_week: 1,
    completed_onboarding: true,
    university_id: "umd",
    cohort: "umd-pilot",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-02T00:00:00.000Z",
    ...overrides,
  }
}

function messageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: "message-1",
    activity_id: "activity-1",
    user_id: "8f14e45f-ceea-467a-9f5f-1c1c1c1c1c1c",
    is_system: false,
    body: "See you by the stairs",
    flagged: false,
    created_at: "2026-07-26T12:00:00.000Z",
    ...overrides,
  }
}

function activityRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "activity-1",
    title: "Coffee for new Terps",
    description: "Public meetup",
    category: "coffee",
    location_id: "loc-stamp",
    host_id: "host-1",
    external_id: null,
    external_url: null,
    capacity: 4,
    start_time: "2026-07-28T18:00:00.000Z",
    availability_block: "weekday_evening",
    source: "user",
    status: "approved",
    university_id: "umd",
    cohort: "umd-pilot",
    comfort_size: "medium",
    safety_preference: "none",
    created_at: "2026-07-26T12:00:00.000Z",
    updated_at: "2026-07-26T12:00:00.000Z",
    ...overrides,
  }
}

describe("profile mapping", () => {
  it("carries the derived display name through unchanged", () => {
    expect(toHuddleProfile(profileRow()).displayName).toBe("Ada L.")
  })

  it("falls back to the first name when the database has no display name", () => {
    expect(toHuddleProfile(profileRow({ display_name: null })).displayName).toBe("Ada")
  })

  it("only carries gender when the caller supplies it", () => {
    expect(toHuddleProfile(profileRow()).gender).toBeUndefined()
    expect(toHuddleProfile(profileRow(), "non_binary").gender).toBe("non_binary")
  })

  it("normalizes an absent avatar to undefined rather than null", () => {
    expect(toHuddleProfile(profileRow()).avatarUrl).toBeUndefined()
  })
})

describe("message mapping", () => {
  it("keeps the author of a student message", () => {
    expect(toChatMessage(messageRow()).userId).toBe(
      "8f14e45f-ceea-467a-9f5f-1c1c1c1c1c1c"
    )
  })

  // The chat thread styles automated openers by this sentinel, so an authorless row must
  // never fall through as a student message.
  it("attributes an authorless system row to Huddle", () => {
    const message = toChatMessage(messageRow({ is_system: true, user_id: null }))
    expect(message.userId).toBe(SYSTEM_USER_ID)
  })

  it("treats a system row as system even when an author survives", () => {
    const message = toChatMessage(messageRow({ is_system: true }))
    expect(message.userId).toBe(SYSTEM_USER_ID)
  })
})

describe("activity mapping", () => {
  it("narrows a known campus identifier", () => {
    expect(toHuddleActivity(activityRow({ university_id: "umb" })).universityId).toBe("umb")
  })

  it("defaults an unrecognized campus to the pilot campus", () => {
    expect(toHuddleActivity(activityRow({ university_id: "other" })).universityId).toBe("umd")
  })

  it("carries a null host through for campus org listings", () => {
    const row = activityRow({ source: "org", host_id: null })
    expect(toHuddleActivity(row).hostId).toBeNull()
  })

  it("exposes the source listing url so org events can link out", () => {
    const row = activityRow({
      source: "org",
      external_url: "https://terplink.umd.edu/event/12478027",
    })
    expect(toHuddleActivity(row).externalUrl).toBe(
      "https://terplink.umd.edu/event/12478027"
    )
  })
})

describe("rsvp and connection mapping", () => {
  it("reports the last status change as the rsvp timestamp", () => {
    const row: RsvpRow = {
      activity_id: "activity-1",
      user_id: "user-1",
      status: "waitlisted",
      created_at: "2026-07-26T12:00:00.000Z",
      updated_at: "2026-07-26T13:00:00.000Z",
    }
    expect(toHuddleRsvp(row).timestamp).toBe("2026-07-26T13:00:00.000Z")
  })

  it("treats any non-accepted connection as pending", () => {
    const row: FriendConnectionRow = {
      id: "connection-1",
      user_id: "user-1",
      friend_id: "user-2",
      status: "something-else",
      created_at: "2026-07-26T12:00:00.000Z",
    }
    expect(toFriendConnection(row).status).toBe("pending")
  })
})

describe("safety flag mapping", () => {
  it("drops unresolved reviewer and timestamp nulls", () => {
    const row: SafetyFlagRow = {
      id: "flag-1",
      type: "chat",
      ref_id: "message-1",
      reason: "Matched safety keyword: bring alcohol",
      status: "open",
      reviewer: null,
      resolved_at: null,
      created_at: "2026-07-26T12:00:00.000Z",
    }
    const flag = toSafetyFlag(row)
    expect(flag.reviewer).toBeUndefined()
    expect(flag.resolvedAt).toBeUndefined()
  })
})

describe("pulse response mapping", () => {
  it("returns only owner-view fields and preserves an unrated null", () => {
    const row: PulseRow = {
      id: "pulse-1",
      activity_id: "activity-1",
      user_id: "user-1",
      did_meet: false,
      rating: null,
      created_at: "2026-08-04T12:00:00.000Z",
    }

    expect(toPulseResponseView(row)).toEqual({
      activityId: "activity-1",
      didMeet: false,
      rating: null,
      createdAt: "2026-08-04T12:00:00.000Z",
    })
  })
})
