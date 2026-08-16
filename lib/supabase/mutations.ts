import type { HuddleBrowserClient } from "@/lib/supabase/client"
import {
  toHuddleProfile,
  toChatMessage,
  toFriendConnection,
  toHuddleActivity,
  toPulseResponseView,
  toSafetyFlag,
  toSafetyReport,
} from "@/lib/supabase/mappers"
import {
  ACTIVITY_COLUMNS,
  CHAT_MESSAGE_COLUMNS,
  FRIEND_CONNECTION_COLUMNS,
  PROFILE_COLUMNS,
  SAFETY_REPORT_COLUMNS,
} from "@/lib/supabase/query-contracts"
import { fetchProfileById, throwOnError } from "@/lib/supabase/queries"
import type { TablesUpdate } from "@/lib/types/database"
import type {
  ActivityStatus,
  ChatMessage,
  FlagStatus,
  FriendConnection,
  HuddleActivity,
  HuddleProfile,
  PulseResponseView,
  RsvpStatus,
  SafetyFlag,
  SafetyReport,
  UniversityId,
} from "@/lib/types/huddle"

export interface OnboardingPayload {
  firstName: string
  lastInitial: string
  status: HuddleProfile["status"]
  gender?: HuddleProfile["gender"]
  interests: HuddleProfile["interests"]
  availabilityBlocks: HuddleProfile["availabilityBlocks"]
  comfortSize: HuddleProfile["comfortSize"]
  safetyPreference: HuddleProfile["safetyPreference"]
}

export interface CreateActivityPayload {
  title: string
  description: string
  category: HuddleActivity["category"]
  locationId: string
  capacity: number
  startTime: string
  availabilityBlock: HuddleActivity["availabilityBlock"]
  comfortSize: HuddleActivity["comfortSize"]
  safetyPreference: HuddleActivity["safetyPreference"]
}

/**
 * Only the columns the authenticated role may write are mapped. Points, streaks and
 * meetup counts are intentionally absent because the database refuses them.
 */
function toProfileUpdate(updates: Partial<HuddleProfile>): TablesUpdate<"profiles"> {
  const patch: TablesUpdate<"profiles"> = {}

  if (updates.firstName !== undefined) patch.first_name = updates.firstName
  if (updates.lastInitial !== undefined) patch.last_initial = updates.lastInitial
  if (updates.status !== undefined) patch.status = updates.status
  if (updates.interests !== undefined) patch.interests = updates.interests
  if (updates.availabilityBlocks !== undefined) {
    patch.availability_blocks = updates.availabilityBlocks
  }
  if (updates.comfortSize !== undefined) patch.comfort_size = updates.comfortSize
  if (updates.safetyPreference !== undefined) {
    patch.safety_preference = updates.safetyPreference
  }
  if (updates.photoColor !== undefined) patch.photo_color = updates.photoColor
  if (updates.avatarUrl !== undefined) patch.avatar_url = updates.avatarUrl
  if (updates.completedOnboarding !== undefined) {
    patch.completed_onboarding = updates.completedOnboarding
  }

  return patch
}

export async function updateProfile(
  supabase: HuddleBrowserClient,
  userId: string,
  updates: Partial<HuddleProfile>
): Promise<HuddleProfile> {
  const patch = toProfileUpdate(updates)

  if (updates.gender !== undefined) {
    await saveGender(supabase, userId, updates.gender)
  }

  if (Object.keys(patch).length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select(PROFILE_COLUMNS)
      .single()
    throwOnError(error, "Could not save your profile")
    if (!data) throw new Error("Could not save your profile")
    return toHuddleProfile(data, updates.gender)
  }

  const profile = await fetchProfileById(supabase, userId)
  if (!profile) throw new Error("Could not save your profile")
  return { ...profile, gender: updates.gender }
}

async function saveGender(
  supabase: HuddleBrowserClient,
  userId: string,
  gender: HuddleProfile["gender"]
): Promise<void> {
  const { error } = await supabase
    .from("student_details")
    .upsert({ profile_id: userId, gender: gender ?? null }, { onConflict: "profile_id" })

  throwOnError(error, "Could not save your profile details")
}

export async function completeOnboarding(
  supabase: HuddleBrowserClient,
  userId: string,
  input: OnboardingPayload
): Promise<HuddleProfile> {
  return updateProfile(supabase, userId, {
    firstName: input.firstName,
    lastInitial: input.lastInitial,
    status: input.status,
    interests: input.interests,
    availabilityBlocks: input.availabilityBlocks,
    comfortSize: input.comfortSize,
    safetyPreference: input.safetyPreference,
    gender: input.gender,
    completedOnboarding: true,
  })
}

export type RsvpOutcome = RsvpStatus | "full"

export async function rsvpActivity(
  supabase: HuddleBrowserClient,
  activityId: string
): Promise<RsvpOutcome> {
  const { data, error } = await supabase.rpc("rsvp_activity", {
    p_activity_id: activityId,
  })

  // The function raises 22023 when the activity is missing or no longer approved, which
  // is a closed door rather than a failure the student should see as an error.
  if (error?.code === "22023") {
    return "full"
  }

  throwOnError(error, "Could not RSVP")
  return (data ?? "going") as RsvpStatus
}

export async function leaveActivity(
  supabase: HuddleBrowserClient,
  activityId: string
): Promise<void> {
  const { error } = await supabase.rpc("leave_activity", {
    p_activity_id: activityId,
  })

  throwOnError(error, "Could not leave the activity")
}

export async function createActivity(
  supabase: HuddleBrowserClient,
  hostId: string,
  universityId: UniversityId,
  input: CreateActivityPayload
): Promise<HuddleActivity> {
  const { data, error } = await supabase
    .from("activities")
    .insert({
      title: input.title,
      description: input.description,
      category: input.category,
      location_id: input.locationId,
      host_id: hostId,
      capacity: input.capacity,
      start_time: input.startTime,
      availability_block: input.availabilityBlock,
      comfort_size: input.comfortSize,
      safety_preference: input.safetyPreference,
      university_id: universityId,
    })
    .select(ACTIVITY_COLUMNS)
    .single()

  throwOnError(error, "Could not create the activity")

  if (!data) {
    throw new Error("Could not create the activity")
  }

  return toHuddleActivity(data)
}

export async function sendMessage(
  supabase: HuddleBrowserClient,
  activityId: string,
  userId: string,
  body: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ activity_id: activityId, user_id: userId, body })
    .select(CHAT_MESSAGE_COLUMNS)
    .single()

  throwOnError(error, "Could not send the message")

  if (!data) {
    throw new Error("Could not send the message")
  }

  return toChatMessage(data)
}

export async function reportSafetyConcern(
  supabase: HuddleBrowserClient,
  reporterId: string,
  context: string,
  reportedUserId?: string
): Promise<SafetyReport> {
  const { data, error } = await supabase
    .from("safety_reports")
    .insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId ?? null,
      context,
    })
    .select(SAFETY_REPORT_COLUMNS)
    .single()

  throwOnError(error, "Could not send the report")

  if (!data) {
    throw new Error("Could not send the report")
  }

  return toSafetyReport(data)
}

export async function resolveFlag(
  supabase: HuddleBrowserClient,
  flagId: string,
  status: FlagStatus
): Promise<SafetyFlag> {
  const { data, error } = await supabase.rpc("resolve_flag", {
    p_flag_id: flagId,
    p_status: status,
  })

  throwOnError(error, "Could not resolve the flag")
  if (!data) throw new Error("Could not resolve the flag")
  return toSafetyFlag(data)
}

export async function reviewActivity(
  supabase: HuddleBrowserClient,
  activityId: string,
  status: Extract<ActivityStatus, "approved" | "rejected">
): Promise<HuddleActivity> {
  const { data, error } = await supabase.rpc("review_activity", {
    p_activity_id: activityId,
    p_status: status,
  })

  throwOnError(error, "Could not review the activity")
  if (!data) throw new Error("Could not review the activity")
  return toHuddleActivity(data)
}

export async function addFriend(
  supabase: HuddleBrowserClient,
  userId: string,
  friendId: string,
  message?: string
): Promise<FriendConnection | null> {
  const { data, error } = await supabase
    .from("friend_connections")
    .insert({ user_id: userId, friend_id: friendId, message: message ?? null } as any)
    .select(FRIEND_CONNECTION_COLUMNS)
    .maybeSingle()

  // A duplicate request is a no-op rather than an error the student should see.
  if (error && error.code === "23505") {
    return null
  }

  throwOnError(error, "Could not send the friend request")
  return data ? toFriendConnection(data) : null
}

export async function acceptFriend(
  supabase: HuddleBrowserClient,
  connectionId: string
): Promise<FriendConnection> {
  const { data, error } = await supabase
    .from("friend_connections")
    .update({ status: "accepted" })
    .eq("id", connectionId)
    .select(FRIEND_CONNECTION_COLUMNS)
    .single()

  throwOnError(error, "Could not accept the friend request")
  if (!data) throw new Error("Could not accept the friend request")
  return toFriendConnection(data)
}

export async function declineFriend(
  supabase: HuddleBrowserClient,
  connectionId: string
): Promise<FriendConnection> {
  const { data, error } = await supabase
    .from("friend_connections")
    .delete()
    .eq("id", connectionId)
    .select(FRIEND_CONNECTION_COLUMNS)
    .single()

  throwOnError(error, "Could not decline the friend request")
  if (!data) throw new Error("Could not decline the friend request")
  return toFriendConnection(data)
}

export async function submitPulseResponse(
  supabase: HuddleBrowserClient,
  activityId: string,
  didMeet: boolean,
  rating: number | null,
): Promise<PulseResponseView> {
  const args = rating === null
    ? { p_activity_id: activityId, p_did_meet: didMeet }
    : { p_activity_id: activityId, p_did_meet: didMeet, p_rating: rating }
  const { data, error } = await supabase.rpc("submit_pulse_response", args)

  throwOnError(error, "Could not save your private response")
  if (!data) throw new Error("Could not save your private response")

  return toPulseResponseView(data)
}

export async function sendDirectMessage(
  supabase: HuddleBrowserClient,
  receiverId: string,
  body: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
  .from('direct_messages' as any)
  .insert({ sender_id: user.id, receiver_id: receiverId, body })

  throwOnError(error, 'Could not send message')
}

export async function unfriend(
  supabase: HuddleBrowserClient,
  friendId: string
): Promise<string> {
  const { error } = await supabase.rpc('unfriend' as any, { p_friend_id: friendId })
  throwOnError(error, 'Could not unfriend')
  return friendId
}
