import type { PostgrestError } from "@supabase/supabase-js"
import type { HuddleBrowserClient } from "@/lib/supabase/client"
import {
  ACTIVITY_COLUMNS,
  FRIEND_CONNECTION_COLUMNS,
  LOCATION_COLUMNS,
  PROFILE_COLUMNS,
  RSVP_COLUMNS,
} from "@/lib/supabase/query-contracts"
import {
  toChatMessage,
  toFriendConnection,
  toHuddleActivity,
  toHuddleLocation,
  toHuddleProfile,
  toHuddleRsvp,
  toPulse,
  toPulseResponseView,
  toSafetyFlag,
  toSafetyReport,
} from "@/lib/supabase/mappers"
import type {
  ActivityRow,
  FriendConnectionRow,
  Profile,
  PublicProfile,
  RsvpRow,
} from "@/lib/types/database"
import type {
  ChatMessage,
  FriendConnection,
  Gender,
  HuddleActivity,
  HuddleLocation,
  HuddleProfile,
  HuddleRsvp,
  Pulse,
  PulseResponseView,
  SafetyFlag,
  SafetyReport,
  UniversityId,
} from "@/lib/types/huddle"

export interface HuddleSnapshot {
  profiles: HuddleProfile[]
  locations: HuddleLocation[]
  activities: HuddleActivity[]
  rsvps: HuddleRsvp[]
  messages: ChatMessage[]
  flags: SafetyFlag[]
  reports: SafetyReport[]
  pulses: Pulse[]
  friends: FriendConnection[]
}

export function throwOnError(error: PostgrestError | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

/**
 * Creates the profile row when a signup predates the auth trigger. Safe to call on every
 * sign-in because the underlying insert is a no-op once the row exists.
 */
export async function ensureProfile(
  supabase: HuddleBrowserClient
): Promise<Profile> {
  const { data, error } = await supabase.rpc("ensure_profile")
  throwOnError(error, "Could not load your profile")

  if (!data) {
    throw new Error("Could not load your profile")
  }

  return data as Profile
}

export async function fetchOwnGender(
  supabase: HuddleBrowserClient,
  userId: string
): Promise<Gender | undefined> {
  const { data, error } = await supabase
    .from("student_details")
    .select("gender")
    .eq("profile_id", userId)
    .maybeSingle()

  throwOnError(error, "Could not load your profile details")
  return data?.gender ?? undefined
}

async function fetchProfileRowById(
  supabase: HuddleBrowserClient,
  userId: string,
): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle()

  throwOnError(error, "Could not load your profile")
  return data as unknown as PublicProfile | null
}

export async function fetchCoreHuddleSnapshot(
  supabase: HuddleBrowserClient,
  userId: string,
  universityId: UniversityId,
  now = new Date(),
): Promise<HuddleSnapshot> {
  const [locations, activities, friends, gender] = await Promise.all([
    supabase
      .from("locations")
      .select(LOCATION_COLUMNS)
      .eq("university_id", universityId)
      .order("name"),
    supabase
      .from("activities")
      .select(ACTIVITY_COLUMNS)
      .eq("university_id", universityId)
      .eq("status", "approved")
      .gte("start_time", now.toISOString())
      .order("start_time")
      .order("id"),
    supabase
      .from("friend_connections")
      .select(FRIEND_CONNECTION_COLUMNS)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    fetchOwnGender(supabase, userId),
  ])

  throwOnError(locations.error, "Could not load meet-points")
  throwOnError(activities.error, "Could not load activities")
  throwOnError(friends.error, "Could not load connections")

  const activityRows = (activities.data ?? []) as unknown as ActivityRow[]
  const friendRows = (friends.data ?? []) as unknown as FriendConnectionRow[]
  const relatedProfileIds = new Set([userId])
  for (const row of friendRows) {
    relatedProfileIds.add(row.user_id)
    relatedProfileIds.add(row.friend_id)
  }

  const profileFilter = [
    `university_id.eq.${universityId}`,
    `id.in.(${[...relatedProfileIds].join(",")})`,
  ].join(",")
  const profileQuery = supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .or(profileFilter)
  const rsvpQuery = activityRows.length === 0
    ? Promise.resolve({ data: [] as RsvpRow[], error: null })
    : supabase
        .from("rsvps")
        .select(RSVP_COLUMNS)
        .in("activity_id", activityRows.map(({ id }) => id))

  const [profiles, rsvps] = await Promise.all([profileQuery, rsvpQuery])
  throwOnError(profiles.error, "Could not load profiles")
  throwOnError(rsvps.error, "Could not load RSVPs")

  let profileRows = (profiles.data ?? []) as unknown as PublicProfile[]
  if (!profileRows.some(({ id }) => id === userId)) {
    await ensureProfile(supabase)
    const ownProfile = await fetchProfileRowById(supabase, userId)
    if (!ownProfile) {
      throw new Error("Could not load your profile")
    }
    profileRows = [...profileRows, ownProfile]
  }

  return {
    profiles: profileRows.map((row) =>
      toHuddleProfile(row, row.id === userId ? gender : undefined)
    ),
    locations: (locations.data ?? []).map(toHuddleLocation),
    activities: activityRows.map(toHuddleActivity),
    rsvps: (rsvps.data ?? []).map(toHuddleRsvp),
    messages: [],
    flags: [],
    reports: [],
    pulses: [],
    friends: friendRows.map(toFriendConnection),
  }
}

export async function fetchActivityMessages(
  supabase: HuddleBrowserClient,
  activityId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("activity_id", activityId)
    .order("created_at")

  throwOnError(error, "Could not load messages")
  return (data ?? []).map(toChatMessage)
}

export async function fetchMessageById(
  supabase: HuddleBrowserClient,
  messageId: string
): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle()

  throwOnError(error, "Could not load message")
  return data ? toChatMessage(data) : null
}

export async function fetchOwnPulseResponse(
  supabase: HuddleBrowserClient,
  activityId: string,
  userId: string,
): Promise<PulseResponseView | null> {
  const { data, error } = await supabase
    .from("pulses")
    .select("*")
    .eq("activity_id", activityId)
    .eq("user_id", userId)
    .maybeSingle()

  throwOnError(error, "Could not load your private response")
  return data ? toPulseResponseView(data) : null
}
