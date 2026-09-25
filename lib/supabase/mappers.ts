import type {
  ActivityRow,
  FriendConnectionRow,
  LocationRow,
  MessageRow,
  PublicProfile,
  PulseRow,
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

/**
 * Automated chat openers have no author in Postgres. The chat UI keys off this sentinel to
 * render them as coming from Huddle rather than from a student.
 */
export const SYSTEM_USER_ID = "system"

function toUniversityId(value: string): UniversityId {
  return value === "umb" ? "umb" : "umd"
}

export function toHuddleProfile(
  row: PublicProfile,
  gender?: Gender | null
): HuddleProfile {
  return {
    userId: row.id,
    displayName: row.display_name ?? row.first_name,
    firstName: row.first_name,
    lastInitial: row.last_initial,
    status: row.status,
    gender: gender ?? undefined,
    interests: row.interests,
    availabilityBlocks: row.availability_blocks,
    comfortSize: row.comfort_size,
    safetyPreference: row.safety_preference,
    avatarUrl: row.avatar_url ?? undefined,
    photoColor: row.photo_color,
    points: row.points,
    streakDays: row.streak_days,
    meetupsThisWeek: row.meetups_this_week,
    completedOnboarding: row.completed_onboarding,
  }
}

export function toHuddleLocation(row: LocationRow): HuddleLocation {
  return {
    id: row.id,
    universityId: toUniversityId(row.university_id),
    name: row.name,
    area: row.area,
    safetyNote: row.safety_note,
  }
}

export function toHuddleActivity(row: ActivityRow): HuddleActivity {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    locationId: row.location_id,
    hostId: row.host_id,
    capacity: row.capacity,
    startTime: row.start_time,
    availabilityBlock: row.availability_block,
    source: row.source,
    status: row.status,
    universityId: toUniversityId(row.university_id),
    cohort: row.cohort,
    comfortSize: row.comfort_size,
    safetyPreference: row.safety_preference,
    createdAt: row.created_at,
    externalUrl: row.external_url,
  }
}

export function toHuddleRsvp(row: RsvpRow): HuddleRsvp {
  return {
    activityId: row.activity_id,
    userId: row.user_id,
    status: row.status,
    timestamp: row.updated_at,
  }
}

export function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    activityId: row.activity_id,
    userId: row.is_system ? SYSTEM_USER_ID : (row.user_id ?? SYSTEM_USER_ID),
    body: row.body,
    createdAt: row.created_at,
    flagged: row.flagged,
  }
}

export function toSafetyFlag(row: SafetyFlagRow): SafetyFlag {
  return {
    id: row.id,
    type: row.type,
    refId: row.ref_id,
    reason: row.reason,
    status: row.status,
    reviewer: row.reviewer ?? undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}

export function toSafetyReport(row: SafetyReportRow): SafetyReport {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reportedUserId: row.reported_user_id ?? undefined,
    context: row.context,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function toPulse(row: PulseRow): Pulse {
  return {
    id: row.id,
    activityId: row.activity_id,
    userId: row.user_id,
    didMeet: row.did_meet,
    rating: row.rating ?? undefined,
    createdAt: row.created_at,
  }
}

export function toPulseResponseView(row: PulseRow): PulseResponseView {
  return {
    activityId: row.activity_id,
    didMeet: row.did_meet,
    rating: row.rating,
    createdAt: row.created_at,
  }
}

export function toFriendConnection(row: FriendConnectionRow): FriendConnection {
  return {
    id: row.id,
    userId: row.user_id,
    friendId: row.friend_id,
    status: row.status === "accepted" ? "accepted" : "pending",
    createdAt: row.created_at,
  }
}
