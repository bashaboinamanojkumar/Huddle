import type { PostgrestError } from "@supabase/supabase-js"
import type { HuddleBrowserClient } from "@/lib/supabase/client"
import {
  ACTIVITY_COLUMNS,
  CHAT_MESSAGE_COLUMNS,
  CHAT_PAGE_SIZE,
  CHAT_PREVIEW_ACTIVITY_LIMIT,
  CHAT_PREVIEW_MESSAGE_LIMIT,
  FRIEND_CONNECTION_COLUMNS,
  LOCATION_COLUMNS,
  PROFILE_COLUMNS,
  PULSE_RESPONSE_COLUMNS,
  RSVP_COLUMNS,
  SAFETY_FLAG_COLUMNS,
  SAFETY_QUEUE_LIMIT,
  SAFETY_REPORT_COLUMNS,
  type MessageCursor,
} from "@/lib/supabase/query-contracts"
import {
  toChatMessage,
  toFriendConnection,
  toHuddleActivity,
  toHuddleLocation,
  toHuddleProfile,
  toHuddleRsvp,
  toPulseResponseView,
  toSafetyFlag,
  toSafetyReport,
} from "@/lib/supabase/mappers"
import type {
  ActivityRow,
  FriendConnectionRow,
  MessageRow,
  Profile,
  PublicProfile,
  RsvpRow,
  SafetyFlagRow,
  SafetyReportRow,
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

export interface MessagePage {
  items: ChatMessage[]
  nextCursor: MessageCursor | null
}

export async function fetchActivityMessagePage(
  supabase: HuddleBrowserClient,
  activityId: string,
  cursor: MessageCursor | null = null,
  pageSize = CHAT_PAGE_SIZE,
): Promise<MessagePage> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > CHAT_PAGE_SIZE) {
    throw new RangeError(`Message page size must be between 1 and ${CHAT_PAGE_SIZE}`)
  }

  let query = supabase
    .from("messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  throwOnError(error, "Could not load messages")
  const rows = (data ?? []) as MessageRow[]
  const hasMore = rows.length > pageSize
  const visible = rows.slice(0, pageSize)
  const oldest = visible.at(-1)
  return {
    items: visible.map(toChatMessage).reverse(),
    nextCursor: hasMore && oldest
      ? { createdAt: oldest.created_at, id: oldest.id }
      : null,
  }
}

export async function fetchChatPreviews(
  supabase: HuddleBrowserClient,
  activityIds: string[],
): Promise<ChatMessage[]> {
  const ids = [...new Set(activityIds)].slice(0, CHAT_PREVIEW_ACTIVITY_LIMIT)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .in("activity_id", ids)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_PREVIEW_MESSAGE_LIMIT)

  throwOnError(error, "Could not load chat previews")
  return (data ?? []).map(toChatMessage)
}

export interface SafetyReviewQueue {
  pendingActivities: HuddleActivity[]
  flags: SafetyFlag[]
  reports: SafetyReport[]
}

export async function fetchSafetyReviewQueue(
  supabase: HuddleBrowserClient,
): Promise<SafetyReviewQueue> {
  const [activities, flags, reports] = await Promise.all([
    supabase
      .from("activities")
      .select(ACTIVITY_COLUMNS)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(SAFETY_QUEUE_LIMIT),
    supabase
      .from("safety_flags")
      .select(SAFETY_FLAG_COLUMNS)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(SAFETY_QUEUE_LIMIT),
    supabase
      .from("safety_reports")
      .select(SAFETY_REPORT_COLUMNS)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(SAFETY_QUEUE_LIMIT),
  ])

  throwOnError(activities.error, "Could not load pending activities")
  throwOnError(flags.error, "Could not load safety flags")
  throwOnError(reports.error, "Could not load safety reports")
  return {
    pendingActivities: ((activities.data ?? []) as ActivityRow[]).map(toHuddleActivity),
    flags: ((flags.data ?? []) as SafetyFlagRow[]).map(toSafetyFlag),
    reports: ((reports.data ?? []) as SafetyReportRow[]).map(toSafetyReport),
  }
}

export async function fetchActivityById(
  supabase: HuddleBrowserClient,
  activityId: string,
): Promise<HuddleActivity | null> {
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_COLUMNS)
    .eq("id", activityId)
    .maybeSingle()

  throwOnError(error, "Could not load activity")
  return data ? toHuddleActivity(data) : null
}

export async function fetchProfileById(
  supabase: HuddleBrowserClient,
  userId: string,
): Promise<HuddleProfile | null> {
  const row = await fetchProfileRowById(supabase, userId)
  return row ? toHuddleProfile(row) : null
}

export async function fetchMessageById(
  supabase: HuddleBrowserClient,
  messageId: string
): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .select(CHAT_MESSAGE_COLUMNS)
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
    .select(PULSE_RESPONSE_COLUMNS)
    .eq("activity_id", activityId)
    .eq("user_id", userId)
    .maybeSingle()

  throwOnError(error, "Could not load your private response")
  return data ? toPulseResponseView(data) : null
}
