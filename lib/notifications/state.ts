import { mergeNotificationPage, reconcileNotification } from "@/lib/notifications/model"
import type {
  NotificationCursor,
  NotificationItem,
  NotificationPreferences,
} from "@/lib/notifications/types"

export type NotificationStatus = "idle" | "loading" | "ready" | "error"

export interface NotificationState {
  userId: string
  items: NotificationItem[]
  status: NotificationStatus
  error: string | null
  cursor: NotificationCursor | null
  hasMore: boolean
  loadingMore: boolean
  preferences: NotificationPreferences | null
  rollbackItems: NotificationItem[] | null
}

export type NotificationAction =
  | { type: "load_started" }
  | {
      type: "load_succeeded"
      items: NotificationItem[]
      cursor: NotificationCursor | null
      hasMore: boolean
      preferences?: NotificationPreferences | null
    }
  | { type: "load_failed"; error: string }
  | { type: "page_started" }
  | {
      type: "page_loaded"
      items: NotificationItem[]
      cursor: NotificationCursor | null
      hasMore: boolean
    }
  | { type: "page_failed"; error: string }
  | { type: "notification_received"; item: NotificationItem }
  | { type: "read_optimistic"; id: string; at: string }
  | { type: "all_read_optimistic"; at: string }
  | { type: "mutation_confirmed" }
  | { type: "rollback" }
  | { type: "preferences_saved"; preferences: NotificationPreferences }
  | { type: "user_reset"; userId: string }

export function createNotificationState(userId: string): NotificationState {
  return {
    userId,
    items: [],
    status: "idle",
    error: null,
    cursor: null,
    hasMore: false,
    loadingMore: false,
    preferences: null,
    rollbackItems: null,
  }
}

export function notificationReducer(
  state: NotificationState,
  action: NotificationAction,
): NotificationState {
  switch (action.type) {
    case "load_started":
      return { ...state, status: "loading", error: null }
    case "load_succeeded":
      return {
        ...state,
        items: action.items,
        cursor: action.cursor,
        hasMore: action.hasMore,
        preferences: action.preferences ?? state.preferences,
        status: "ready",
        error: null,
        loadingMore: false,
        rollbackItems: null,
      }
    case "load_failed":
      return { ...state, status: "error", error: action.error, loadingMore: false }
    case "page_started":
      return { ...state, loadingMore: true, error: null }
    case "page_loaded":
      return {
        ...state,
        items: mergeNotificationPage(state.items, action.items),
        cursor: action.cursor,
        hasMore: action.hasMore,
        loadingMore: false,
        error: null,
      }
    case "page_failed":
      return { ...state, loadingMore: false, error: action.error }
    case "notification_received":
      return {
        ...state,
        items: reconcileNotification(state.items, action.item),
      }
    case "read_optimistic":
      return {
        ...state,
        rollbackItems: state.items,
        items: state.items.map((item) => item.id === action.id
          ? { ...item, readAt: item.readAt ?? action.at }
          : item),
      }
    case "all_read_optimistic":
      return {
        ...state,
        rollbackItems: state.items,
        items: state.items.map((item) => ({
          ...item,
          readAt: item.readAt ?? action.at,
        })),
      }
    case "mutation_confirmed":
      return { ...state, rollbackItems: null }
    case "rollback":
      return state.rollbackItems
        ? { ...state, items: state.rollbackItems, rollbackItems: null }
        : state
    case "preferences_saved":
      return { ...state, preferences: action.preferences }
    case "user_reset":
      return createNotificationState(action.userId)
  }
}

export function shouldShowArrivalToast(
  permission: NotificationPermission | undefined,
): boolean {
  return permission !== "granted"
}

