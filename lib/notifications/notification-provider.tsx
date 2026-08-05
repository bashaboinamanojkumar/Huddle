"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import {
  fetchNotificationPage,
  fetchNotificationPreferences,
  fetchNotificationRuntimeConfig,
  markAllNotificationsRead,
  markNotificationRead,
  toNotificationItem,
  updateNotificationPreferences,
} from "@/lib/notifications/api"
import { countUnread } from "@/lib/notifications/model"
import {
  createNotificationState,
  notificationReducer,
  shouldShowArrivalToast,
  type NotificationStatus,
} from "@/lib/notifications/state"
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationRuntimeConfig,
} from "@/lib/notifications/types"
import { createClient } from "@/lib/supabase/client"
import { useHuddle } from "@/lib/store/huddle-store"
import type { NotificationRow } from "@/lib/types/database"

interface NotificationContextValue {
  items: NotificationItem[]
  status: NotificationStatus
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  unreadCount: number
  unreadChatCount: number
  preferences: NotificationPreferences | null
  runtime: NotificationRuntimeConfig | null
  loadMore(): Promise<void>
  retry(): void
  markRead(id: string): Promise<void>
  markAllRead(): Promise<void>
  savePreferences(preferences: NotificationPreferences): Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { state: huddleState } = useHuddle()
  const userId = huddleState.session?.userId ?? ""
  const [state, dispatch] = useReducer(
    notificationReducer,
    userId,
    createNotificationState,
  )
  const [runtime, setRuntime] = useState<NotificationRuntimeConfig | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const activeUserRef = useRef(userId)

  useEffect(() => {
    activeUserRef.current = userId
    dispatch({ type: "user_reset", userId })
    setRuntime(null)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let active = true
    const supabase = createClient()

    const load = async () => {
      dispatch({ type: "load_started" })
      try {
        const [page, preferences, runtimeConfig] = await Promise.all([
          fetchNotificationPage(supabase, userId),
          fetchNotificationPreferences(supabase, userId),
          fetchNotificationRuntimeConfig(supabase),
        ])
        if (!active || activeUserRef.current !== userId) return
        setRuntime(runtimeConfig)
        dispatch({
          type: "load_succeeded",
          items: page.items,
          cursor: page.nextCursor,
          hasMore: page.hasMore,
          preferences,
        })
      } catch (error) {
        if (!active || activeUserRef.current !== userId) return
        dispatch({
          type: "load_failed",
          error: errorMessage(error, "Could not load notifications"),
        })
      }
    }

    void load()

    const reconcile = (row: NotificationRow, announce: boolean) => {
      const item = toNotificationItem(row)
      if (!active || item.userId !== userId || activeUserRef.current !== userId) return
      dispatch({ type: "notification_received", item })

      const permission = typeof Notification === "undefined"
        ? undefined
        : Notification.permission
      if (announce && shouldShowArrivalToast(permission)) {
        toast(item.title)
      }
    }

    const channel = supabase
      .channel(`huddle-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => reconcile(payload.new as NotificationRow, true),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => reconcile(payload.new as NotificationRow, false),
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [reloadToken, userId])

  const unread = useMemo(() => countUnread(state.items), [state.items])

  useEffect(() => {
    if (typeof navigator === "undefined") return
    if (unread.total > 0 && "setAppBadge" in navigator) {
      void navigator.setAppBadge(unread.total).catch(() => undefined)
    } else if ("clearAppBadge" in navigator) {
      void navigator.clearAppBadge().catch(() => undefined)
    }
  }, [unread.total])

  const retry = useCallback(() => setReloadToken((value) => value + 1), [])

  const loadMore = useCallback(async () => {
    if (!userId || !state.hasMore || !state.cursor || state.loadingMore) return
    dispatch({ type: "page_started" })
    try {
      const page = await fetchNotificationPage(createClient(), userId, state.cursor)
      if (activeUserRef.current !== userId) return
      dispatch({
        type: "page_loaded",
        items: page.items,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
      })
    } catch (error) {
      dispatch({
        type: "page_failed",
        error: errorMessage(error, "Could not load more notifications"),
      })
    }
  }, [state.cursor, state.hasMore, state.loadingMore, userId])

  const markRead = useCallback(async (id: string) => {
    if (!state.items.some((item) => item.id === id && item.readAt === null)) return
    dispatch({ type: "read_optimistic", id, at: new Date().toISOString() })
    try {
      const item = await markNotificationRead(createClient(), id)
      if (activeUserRef.current !== userId) return
      dispatch({ type: "notification_received", item })
      dispatch({ type: "mutation_confirmed" })
    } catch (error) {
      dispatch({ type: "rollback" })
      throw error
    }
  }, [state.items, userId])

  const markAllRead = useCallback(async () => {
    if (unread.total === 0) return
    dispatch({ type: "all_read_optimistic", at: new Date().toISOString() })
    try {
      await markAllNotificationsRead(createClient())
      if (activeUserRef.current !== userId) return
      dispatch({ type: "mutation_confirmed" })
    } catch (error) {
      dispatch({ type: "rollback" })
      throw error
    }
  }, [unread.total, userId])

  const savePreferences = useCallback(async (preferences: NotificationPreferences) => {
    const saved = await updateNotificationPreferences(createClient(), preferences)
    if (activeUserRef.current !== userId) return
    dispatch({ type: "preferences_saved", preferences: saved })
  }, [userId])

  const value = useMemo<NotificationContextValue>(() => ({
    items: state.items,
    status: state.status,
    error: state.error,
    hasMore: state.hasMore,
    loadingMore: state.loadingMore,
    unreadCount: unread.total,
    unreadChatCount: unread.chat,
    preferences: state.preferences,
    runtime,
    loadMore,
    retry,
    markRead,
    markAllRead,
    savePreferences,
  }), [
    loadMore,
    markAllRead,
    markRead,
    retry,
    runtime,
    savePreferences,
    state.error,
    state.hasMore,
    state.items,
    state.loadingMore,
    state.preferences,
    state.status,
    unread.chat,
    unread.total,
  ])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationProvider")
  }
  return context
}

