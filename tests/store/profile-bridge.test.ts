import { describe, expect, it } from "vitest"
import { seedState } from "@/lib/data/seed"
import { bridgeAuthenticatedIdentity } from "@/lib/store/profile-bridge"
import type { HuddleState } from "@/lib/types/huddle"

function cleanState(): HuddleState {
  return { ...structuredClone(seedState), session: null }
}

describe("Supabase identity bridge", () => {
  it("creates a new UMD user and incomplete profile from Google metadata", () => {
    const initial = cleanState()
    const result = bridgeAuthenticatedIdentity(initial, {
      id: "supabase-umd",
      email: " Ada.Lovelace@UMD.edu ",
      fullName: "Ada Lovelace",
      avatarUrl: "https://images.example/ada.png",
    })

    expect(result.destination).toBe("/onboarding")
    expect(result.state.session).toMatchObject({
      userId: "supabase-umd",
      email: "ada.lovelace@umd.edu",
      universityId: "umd",
    })
    expect(result.state.users).toHaveLength(initial.users.length + 1)
    expect(result.state.profiles).toContainEqual(
      expect.objectContaining({
        userId: "supabase-umd",
        firstName: "Ada",
        lastInitial: "L",
        displayName: "Ada L.",
        avatarUrl: "https://images.example/ada.png",
        completedOnboarding: false,
      })
    )
  })

  it("maps umaryland.edu identities to the UMB university id", () => {
    const result = bridgeAuthenticatedIdentity(cleanState(), {
      id: "supabase-umb",
      email: "student@umaryland.edu",
      fullName: "Grace Hopper",
    })

    expect(result.state.session?.universityId).toBe("umb")
    expect(result.state.users.at(-1)?.universityId).toBe("umb")
  })

  it("falls back to email-derived names when Google metadata is absent", () => {
    const result = bridgeAuthenticatedIdentity(cleanState(), {
      id: "supabase-fallback",
      email: "jane.doe@umd.edu",
    })

    expect(result.state.profiles.at(-1)).toMatchObject({
      firstName: "Jane",
      lastInitial: "D",
      displayName: "Jane D.",
    })
  })

  it("is idempotent and preserves a returning user's profile and activity state", () => {
    const first = bridgeAuthenticatedIdentity(cleanState(), {
      id: "supabase-returning",
      email: "returning@umd.edu",
      fullName: "Returning Student",
    })
    const profileIndex = first.state.profiles.findIndex(
      (profile) => profile.userId === "supabase-returning"
    )
    first.state.profiles[profileIndex] = {
      ...first.state.profiles[profileIndex],
      firstName: "Chosen",
      interests: ["study", "coffee", "games"],
      completedOnboarding: true,
    }
    const activities = structuredClone(first.state.activities)

    const second = bridgeAuthenticatedIdentity(
      first.state,
      {
        id: "supabase-returning",
        email: "returning@umd.edu",
        fullName: "Changed Google Name",
      },
      "/app/chats"
    )

    expect(second.destination).toBe("/app/chats")
    expect(second.state.users).toHaveLength(first.state.users.length)
    expect(second.state.profiles).toHaveLength(first.state.profiles.length)
    expect(
      second.state.profiles.find((profile) => profile.userId === "supabase-returning")
    ).toMatchObject({
      firstName: "Chosen",
      interests: ["study", "coffee", "games"],
      completedOnboarding: true,
    })
    expect(second.state.activities).toEqual(activities)
  })

  it("migrates a legacy email-matched local identity to the stable Supabase id", () => {
    const initial = cleanState()
    initial.users.push({
      id: "legacy-local-id",
      email: "legacy@umd.edu",
      universityId: "umd",
      cohort: "umd-pilot",
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    initial.profiles.push({
      ...structuredClone(initial.profiles[0]),
      userId: "legacy-local-id",
      firstName: "Legacy",
      completedOnboarding: true,
    })
    initial.rsvps.push({
      activityId: initial.activities[0].id,
      userId: "legacy-local-id",
      status: "going",
      timestamp: "2026-01-01T00:00:00.000Z",
    })

    const result = bridgeAuthenticatedIdentity(initial, {
      id: "supabase-stable-id",
      email: "legacy@umd.edu",
      fullName: "Google Name",
    })

    expect(result.state.users.filter((user) => user.email === "legacy@umd.edu")).toHaveLength(1)
    expect(result.state.users.some((user) => user.id === "legacy-local-id")).toBe(false)
    expect(result.state.profiles.some((profile) => profile.userId === "legacy-local-id")).toBe(false)
    expect(result.state.rsvps.some((rsvp) => rsvp.userId === "supabase-stable-id")).toBe(true)
    expect(result.destination).toBe("/app")
  })

  it("rejects an unsafe returning-user destination", () => {
    const initial = cleanState()
    const existingProfile = initial.profiles[0]
    initial.users[0] = { ...initial.users[0], id: "safe-user", email: "safe@umd.edu" }
    initial.profiles[0] = { ...existingProfile, userId: "safe-user", completedOnboarding: true }

    const result = bridgeAuthenticatedIdentity(
      initial,
      { id: "safe-user", email: "safe@umd.edu" },
      "//evil.example"
    )

    expect(result.destination).toBe("/app")
  })
})
