import type { PostgrestError } from "@supabase/supabase-js"
import type { HuddleBrowserClient } from "@/lib/supabase/client"
import {
  toChatMessage,
  toFriendConnection,
  toHuddleActivity,
  toHuddleLocation,
  toHuddleProfile,
  toHuddleRsvp,
  toPulse,
  toSafetyFlag,
  toSafetyReport,
} from "@/lib/supabase/mappers"
import type { Profile, PublicProfile } from "@/lib/types/database"
import type {
  ChatMessage,
  FriendConnection,
  Gender,
  HuddleActivity,
  HuddleLocation,
  HuddleProfile,
  HuddleRsvp,
  Pulse,
  SafetyFlag,
  SafetyReport,
} from "@/lib/types/huddle"

/**
 * The authenticated role has no column grant on `email`, so it must stay out of every
 * client-side select or PostgREST rejects the whole request.
 */
const PROFILE_COLUMNS =
  "id, first_name, last_name, last_initial, display_name, username, avatar_url, bio, " +
  "graduation_year, major, minor, is_verified, status, interests, availability_blocks, " +
  "comfort_size, safety_preference, photo_color, points, streak_days, meetups_this_week, " +
  "completed_onboarding, university_id, cohort, created_at, updated_at"

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

export async function fetchHuddleSnapshot(
  supabase: HuddleBrowserClient,
  userId: string
): Promise<HuddleSnapshot> {
  const [
    profiles,
    locations,
    activities,
    rsvps,
    messages,
    flags,
    reports,
    pulses,
    friends,
    gender,
  ] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS),
    supabase.from("locations").select("*").order("name"),
    supabase.from("activities").select("*").order("start_time"),
    supabase.from("rsvps").select("*"),
    supabase.from("messages").select("*").order("created_at"),
    supabase.from("safety_flags").select("*").order("created_at", { ascending: false }),
    supabase.from("safety_reports").select("*").order("created_at", { ascending: false }),
    supabase.from("pulses").select("*"),
    supabase.from("friend_connections").select("*"),
    fetchOwnGender(supabase, userId),
  ])

  throwOnError(profiles.error, "Could not load profiles")
  throwOnError(locations.error, "Could not load meet-points")
  throwOnError(activities.error, "Could not load activities")
  throwOnError(rsvps.error, "Could not load RSVPs")
  throwOnError(messages.error, "Could not load messages")
  throwOnError(flags.error, "Could not load safety flags")
  throwOnError(reports.error, "Could not load safety reports")
  throwOnError(pulses.error, "Could not load pulses")
  throwOnError(friends.error, "Could not load connections")

  const profileRows = (profiles.data ?? []) as unknown as PublicProfile[]

  return {
    // Gender is private to its owner, so it is only ever attached to the viewer's own row.
    profiles: profileRows.map((row) =>
      toHuddleProfile(row, row.id === userId ? gender : undefined)
    ),
    locations: (locations.data ?? []).map(toHuddleLocation),
    activities: (activities.data ?? []).map(toHuddleActivity),
    rsvps: (rsvps.data ?? []).map(toHuddleRsvp),
    messages: (messages.data ?? []).map(toChatMessage),
    flags: (flags.data ?? []).map(toSafetyFlag),
    reports: (reports.data ?? []).map(toSafetyReport),
    pulses: (pulses.data ?? []).map(toPulse),
    friends: (friends.data ?? []).map(toFriendConnection),
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
