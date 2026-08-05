import type { HuddleBrowserClient } from "@/lib/supabase/client"
import { throwOnError } from "@/lib/supabase/queries"
import type {
  NotificationPreferenceRow,
  NotificationRow,
  NotificationRuntimeConfigRow,
  PushSubscriptionRow,
} from "@/lib/types/database"
import type {
  NotificationCursor,
  NotificationItem,
  NotificationPage,
  NotificationPreferences,
  NotificationRuntimeConfig,
  PushSubscriptionRecord,
  SavePushSubscriptionInput,
} from "@/lib/notifications/types"

const NOTIFICATION_COLUMNS =
  "id,user_id,type,category,title,body,url,data,dedupe_key,read_at,seen_at,created_at,last_event_at"
const SUBSCRIPTION_COLUMNS =
  "id,user_id,endpoint,user_agent,created_at,updated_at,last_seen_at,disabled_at"

export function toNotificationItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    category: row.category,
    title: row.title,
    body: row.body,
    path: row.url,
    data: row.data,
    dedupeKey: row.dedupe_key,
    readAt: row.read_at,
    seenAt: row.seen_at,
    createdAt: row.created_at,
    lastEventAt: row.last_event_at,
  }
}

export function toNotificationPreferences(
  row: NotificationPreferenceRow,
): NotificationPreferences {
  return {
    userId: row.user_id,
    pushEnabled: row.push_enabled,
    chatEnabled: row.chat_enabled,
    activitiesEnabled: row.activities_enabled,
    remindersEnabled: row.reminders_enabled,
    socialEnabled: row.social_enabled,
    safetyEnabled: row.safety_enabled,
    digestEnabled: row.digest_enabled,
    rewardsEnabled: false,
    quietHoursStart: row.quiet_hours_start ?? "22:00:00",
    quietHoursEnd: row.quiet_hours_end ?? "08:00:00",
    timezone: row.timezone,
    dailyPushCap: row.daily_push_cap,
    updatedAt: row.updated_at,
  }
}

export function toPushSubscriptionRecord(
  row: Pick<
    PushSubscriptionRow,
    "id" | "user_id" | "endpoint" | "user_agent" | "created_at" |
      "updated_at" | "last_seen_at" | "disabled_at"
  >,
): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    disabledAt: row.disabled_at,
  }
}

export function toRuntimeConfig(
  row: NotificationRuntimeConfigRow,
): NotificationRuntimeConfig {
  return {
    notificationCoreEnabled: row.notification_core_enabled,
    pushEnabled: row.push_enabled,
    rewardsEnabled: false,
    pushRolloutPercentage: row.push_rollout_percentage,
  }
}

export async function fetchNotificationPage(
  supabase: HuddleBrowserClient,
  userId: string,
  cursor: NotificationCursor | null = null,
  pageSize = 25,
): Promise<NotificationPage> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new RangeError("Notification page size must be between 1 and 50")
  }

  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("user_id", userId)
    .order("last_event_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1)

  if (cursor) {
    query = query.or(
      `last_event_at.lt.${cursor.lastEventAt},and(last_event_at.eq.${cursor.lastEventAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  throwOnError(error, "Could not load notifications")

  const rows = (data ?? []) as NotificationRow[]
  const hasMore = rows.length > pageSize
  const items = rows.slice(0, pageSize).map(toNotificationItem)
  const lastItem = items.at(-1)

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastItem
      ? { lastEventAt: lastItem.lastEventAt, id: lastItem.id }
      : null,
  }
}

export async function fetchNotificationPreferences(
  supabase: HuddleBrowserClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single()
  throwOnError(error, "Could not load notification settings")
  return toNotificationPreferences(data as NotificationPreferenceRow)
}

export async function fetchNotificationRuntimeConfig(
  supabase: HuddleBrowserClient,
): Promise<NotificationRuntimeConfig> {
  const { data, error } = await supabase
    .from("notification_runtime_config")
    .select("id,notification_core_enabled,push_enabled,rewards_enabled,push_rollout_percentage")
    .eq("id", true)
    .single()
  throwOnError(error, "Could not load notification availability")
  return toRuntimeConfig(data as NotificationRuntimeConfigRow)
}

export async function fetchPushSubscriptions(
  supabase: HuddleBrowserClient,
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
  throwOnError(error, "Could not load browser subscriptions")
  return (data ?? []).map((row) => toPushSubscriptionRecord(row))
}

export async function markNotificationRead(
  supabase: HuddleBrowserClient,
  notificationId: string,
): Promise<NotificationItem> {
  const { data, error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  })
  throwOnError(error, "Could not mark notification read")
  if (!data) throw new Error("Could not mark notification read")
  return toNotificationItem(data)
}

export async function markAllNotificationsRead(
  supabase: HuddleBrowserClient,
): Promise<number> {
  const { data, error } = await supabase.rpc("mark_all_notifications_read")
  throwOnError(error, "Could not mark notifications read")
  return data ?? 0
}

export async function updateNotificationPreferences(
  supabase: HuddleBrowserClient,
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase.rpc("update_notification_preferences", {
    p_push_enabled: preferences.pushEnabled,
    p_chat_enabled: preferences.chatEnabled,
    p_activities_enabled: preferences.activitiesEnabled,
    p_reminders_enabled: preferences.remindersEnabled,
    p_social_enabled: preferences.socialEnabled,
    p_safety_enabled: preferences.safetyEnabled,
    p_digest_enabled: preferences.digestEnabled,
    p_rewards_enabled: false,
    p_quiet_hours_start: preferences.quietHoursStart,
    p_quiet_hours_end: preferences.quietHoursEnd,
    p_timezone: preferences.timezone,
    p_daily_push_cap: preferences.dailyPushCap,
  })
  throwOnError(error, "Could not save notification settings")
  if (!data) throw new Error("Could not save notification settings")
  return toNotificationPreferences(data)
}

export async function savePushSubscription(
  supabase: HuddleBrowserClient,
  input: SavePushSubscriptionInput,
): Promise<PushSubscriptionRecord> {
  const { data, error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_user_agent: input.userAgent ?? undefined,
  })
  throwOnError(error, "Could not save this browser subscription")
  if (!data) throw new Error("Could not save this browser subscription")
  return toPushSubscriptionRecord(data)
}

export async function disablePushSubscription(
  supabase: HuddleBrowserClient,
  endpoint: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("disable_push_subscription", {
    p_endpoint: endpoint,
  })
  throwOnError(error, "Could not disable this browser subscription")
  return data ?? false
}
