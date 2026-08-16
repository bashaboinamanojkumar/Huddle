export const PROFILE_COLUMNS = [
  "id",
  "first_name",
  "last_name",
  "last_initial",
  "display_name",
  "username",
  "avatar_url",
  "bio",
  "graduation_year",
  "major",
  "minor",
  "is_verified",
  "status",
  "interests",
  "availability_blocks",
  "comfort_size",
  "safety_preference",
  "photo_color",
  "points",
  "streak_days",
  "meetups_this_week",
  "completed_onboarding",
  "university_id",
  "cohort",
  "created_at",
  "updated_at",
].join(",")

export const LOCATION_COLUMNS = "id,university_id,name,area,safety_note"
export const ACTIVITY_COLUMNS = [
  "id",
  "title",
  "description",
  "category",
  "location_id",
  "host_id",
  "external_id",
  "external_url",
  "capacity",
  "start_time",
  "availability_block",
  "source",
  "status",
  "university_id",
  "cohort",
  "comfort_size",
  "safety_preference",
  "created_at",
  "updated_at",
].join(",")
export const RSVP_COLUMNS = "activity_id,user_id,status,created_at,updated_at"
export const FRIEND_CONNECTION_COLUMNS = "id,user_id,friend_id,status,created_at"
export const CHAT_MESSAGE_COLUMNS =
  "id,activity_id,user_id,is_system,body,flagged,created_at"
export const SAFETY_FLAG_COLUMNS =
  "id,type,ref_id,reason,status,reviewer,created_at,resolved_at"
export const SAFETY_REPORT_COLUMNS =
  "id,reporter_id,reported_user_id,context,status,created_at"
export const PULSE_RESPONSE_COLUMNS =
  "id,activity_id,user_id,did_meet,rating,created_at"
export const NOTIFICATION_PREFERENCE_COLUMNS = [
  "user_id",
  "push_enabled",
  "chat_enabled",
  "activities_enabled",
  "reminders_enabled",
  "social_enabled",
  "safety_enabled",
  "digest_enabled",
  "rewards_enabled",
  "quiet_hours_start",
  "quiet_hours_end",
  "timezone",
  "daily_push_cap",
  "created_at",
  "updated_at",
].join(",")

export const CORE_TABLES = [
  "profiles",
  "locations",
  "activities",
  "rsvps",
  "friend_connections",
  "student_details",
] as const

export const CHAT_PAGE_SIZE = 50
export const CHAT_PREVIEW_ACTIVITY_LIMIT = 20
export const CHAT_PREVIEW_MESSAGE_LIMIT = 200
export const SAFETY_QUEUE_LIMIT = 100

export interface MessageCursor {
  createdAt: string
  id: string
}
