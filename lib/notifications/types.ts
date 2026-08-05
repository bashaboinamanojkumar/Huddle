import type { Json } from "@/lib/types/database"

export type NotificationCategory =
  | "chat"
  | "activities"
  | "reminders"
  | "social"
  | "safety"
  | "digest"
  | "rewards"

export type NotificationType =
  | "chat_message"
  | "chat_opened"
  | "activity_joined"
  | "activity_approved"
  | "activity_rejected"
  | "event_reminder_24h"
  | "event_reminder_1h"
  | "waitlist_promoted"
  | "pulse_prompt"
  | "friend_request"
  | "friend_accepted"
  | "friend_rsvp"
  | "safety_review"
  | "safety_report_status"
  | "activity_match_digest"
  | "weekly_recap"
  | "streak_at_risk"
  | "points_milestone"
  | "badge_unlocked"
  | "leaderboard_placement"

export interface NotificationItem {
  id: string
  userId: string
  type: NotificationType
  category: NotificationCategory
  title: string
  body: string
  path: string
  data: Json
  dedupeKey: string
  readAt: string | null
  seenAt: string | null
  createdAt: string
  lastEventAt: string
}

export interface NotificationPreferences {
  userId: string
  pushEnabled: boolean
  chatEnabled: boolean
  activitiesEnabled: boolean
  remindersEnabled: boolean
  socialEnabled: boolean
  safetyEnabled: boolean
  digestEnabled: boolean
  rewardsEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  timezone: string
  dailyPushCap: number
  updatedAt: string
}

export interface PushSubscriptionRecord {
  id: string
  userId: string
  endpoint: string
  userAgent: string | null
  createdAt: string
  updatedAt: string
  lastSeenAt: string
  disabledAt: string | null
}

export interface NotificationRuntimeConfig {
  notificationCoreEnabled: boolean
  pushEnabled: boolean
  rewardsEnabled: boolean
  pushRolloutPercentage: number
}

export interface NotificationCursor {
  lastEventAt: string
  id: string
}

export interface NotificationPage {
  items: NotificationItem[]
  nextCursor: NotificationCursor | null
  hasMore: boolean
}

export interface NotificationGroups {
  today: NotificationItem[]
  thisWeek: NotificationItem[]
  older: NotificationItem[]
}

export interface UnreadCounts {
  total: number
  chat: number
}

export interface SavePushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string | null
}

