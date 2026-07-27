import { normalizeCampusEmail, normalizeReturnPath } from "@/lib/auth/policy"
import type {
  HuddleProfile,
  HuddleState,
  UniversityId,
} from "@/lib/types/huddle"

const SESSION_DAYS = 30

export interface AuthenticatedIdentity {
  id: string
  email: string
  fullName?: string
  avatarUrl?: string
}

export interface IdentityBridgeResult {
  state: HuddleState
  destination: string
}

function addDays(date: Date, days: number): string {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result.toISOString()
}

function emailName(email: string) {
  const local = email.split("@")[0] || "student"
  const parts = local.split(/[._-]/).filter(Boolean)
  const firstName = parts[0]
    ? `${parts[0][0].toUpperCase()}${parts[0].slice(1)}`
    : "Student"
  const lastInitial = parts[1]?.[0]?.toUpperCase() || "T"
  return { firstName, lastInitial }
}

function profileName(identity: AuthenticatedIdentity, email: string) {
  const fallback = emailName(email)
  const nameParts = identity.fullName?.trim().split(/\s+/).filter(Boolean) ?? []
  const firstName = nameParts[0] || fallback.firstName
  const lastInitial =
    (nameParts.length > 1 ? nameParts.at(-1)?.[0]?.toUpperCase() : undefined) ||
    fallback.lastInitial
  return {
    firstName,
    lastInitial,
    displayName: `${firstName} ${lastInitial}.`,
  }
}

function newProfile(
  identity: AuthenticatedIdentity,
  email: string
): HuddleProfile {
  const name = profileName(identity, email)
  const avatarUrl = identity.avatarUrl?.trim() || undefined
  return {
    userId: identity.id,
    ...name,
    status: "other",
    interests: [],
    availabilityBlocks: [],
    comfortSize: "either",
    safetyPreference: "none",
    avatarUrl,
    photoColor: "#d05b47",
    points: 0,
    streakDays: 0,
    meetupsThisWeek: 0,
    completedOnboarding: false,
  }
}

function migrateIdentity(
  state: HuddleState,
  previousId: string,
  identity: AuthenticatedIdentity,
  email: string,
  universityId: UniversityId
): HuddleState {
  const replaceId = (value: string) => (value === previousId ? identity.id : value)

  return {
    ...state,
    users: state.users.map((user) =>
      user.id === previousId
        ? { ...user, id: identity.id, email, universityId }
        : user
    ),
    profiles: state.profiles.map((profile) =>
      profile.userId === previousId
        ? { ...profile, userId: identity.id }
        : profile
    ),
    activities: state.activities.map((activity) => ({
      ...activity,
      hostId: replaceId(activity.hostId),
    })),
    rsvps: state.rsvps.map((rsvp) => ({ ...rsvp, userId: replaceId(rsvp.userId) })),
    messages: state.messages.map((message) => ({
      ...message,
      userId: replaceId(message.userId),
    })),
    reports: state.reports.map((report) => ({
      ...report,
      reporterId: replaceId(report.reporterId),
      reportedUserId: report.reportedUserId
        ? replaceId(report.reportedUserId)
        : undefined,
    })),
    pulses: state.pulses.map((pulse) => ({ ...pulse, userId: replaceId(pulse.userId) })),
    friends: state.friends.map((friend) => ({
      ...friend,
      userId: replaceId(friend.userId),
      friendId: replaceId(friend.friendId),
    })),
  }
}

export function bridgeAuthenticatedIdentity(
  state: HuddleState,
  identity: AuthenticatedIdentity,
  requestedPath?: string | null
): IdentityBridgeResult {
  const email = normalizeCampusEmail(identity.email)
  if (!email || !identity.id.trim()) {
    throw new Error("Cannot bridge an ineligible identity")
  }

  const now = new Date()
  const universityId: UniversityId = email.endsWith("@umaryland.edu") ? "umb" : "umd"
  const exactUser = state.users.find((user) => user.id === identity.id)
  const emailUser = state.users.find((user) => user.email.toLowerCase() === email)
  let nextState: HuddleState

  if (!exactUser && emailUser && emailUser.id !== identity.id) {
    nextState = migrateIdentity(
      state,
      emailUser.id,
      identity,
      email,
      universityId
    )
  } else if (!exactUser) {
    nextState = {
      ...state,
      users: [
        ...state.users,
        {
          id: identity.id,
          email,
          universityId,
          cohort: "umd-pilot",
          createdAt: now.toISOString(),
        },
      ],
      profiles: [...state.profiles, newProfile(identity, email)],
    }
  } else {
    nextState = {
      ...state,
      users: state.users.map((user) =>
        user.id === identity.id ? { ...user, email, universityId } : user
      ),
    }
  }

  if (!nextState.profiles.some((profile) => profile.userId === identity.id)) {
    nextState = {
      ...nextState,
      profiles: [...nextState.profiles, newProfile(identity, email)],
    }
  }

  nextState = {
    ...nextState,
    session: {
      userId: identity.id,
      email,
      expiresAt: addDays(now, SESSION_DAYS),
      universityId,
    },
  }

  const profile = nextState.profiles.find((item) => item.userId === identity.id)
  return {
    state: nextState,
    destination: profile?.completedOnboarding
      ? normalizeReturnPath(requestedPath)
      : "/onboarding",
  }
}
