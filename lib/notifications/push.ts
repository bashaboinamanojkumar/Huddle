import {
  disablePushSubscription,
  savePushSubscription,
} from "@/lib/notifications/api"
import type { SavePushSubscriptionInput } from "@/lib/notifications/types"
import type { HuddleBrowserClient } from "@/lib/supabase/client"

export const PUSH_RSVP_ELIGIBLE_AT_KEY = "huddle.push.rsvpEligibleAt"
export const PUSH_DISMISSED_UNTIL_KEY = "huddle.push.dismissedUntil"
export const PUSH_SUBSCRIPTION_CHANGED_EVENT = "huddle:push-subscription-changed"
export const RSVP_SUCCESS_EVENT = "huddle:rsvp-success"
const PROMPT_COOLDOWN_DAYS = 14

export type PushPromptDecision = "hidden" | "install" | "explain" | "denied"

interface PromptDecisionInput {
  supported: boolean
  permission: NotificationPermission
  rsvpEligibleAt: string | null
  dismissedUntil: string | null
  isIos: boolean
  isStandalone: boolean
  now: Date
}

interface StorageReaderWriter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface SerializablePushSubscription {
  endpoint: string
  toJSON(): PushSubscriptionJSON
}

export function decidePushPrompt(input: PromptDecisionInput): PushPromptDecision {
  if (!input.supported || !input.rsvpEligibleAt || input.permission === "granted") {
    return "hidden"
  }

  const dismissedUntil = input.dismissedUntil
    ? new Date(input.dismissedUntil).getTime()
    : Number.NaN
  if (Number.isFinite(dismissedUntil) && dismissedUntil > input.now.getTime()) {
    return "hidden"
  }
  if (input.permission === "denied") return "denied"
  if (input.isIos && !input.isStandalone) return "install"
  return "explain"
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
}

export function isIosDevice(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  platform = typeof navigator === "undefined" ? "" : navigator.platform,
  maxTouchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
): boolean {
  return /iphone|ipad|ipod/i.test(userAgent)
    || (platform === "MacIntel" && maxTouchPoints > 1)
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches
    || iosNavigator.standalone === true
}

export function recordRsvpPushEligibility(
  storage: StorageReaderWriter,
  now = new Date(),
): void {
  if (!storage.getItem(PUSH_RSVP_ELIGIBLE_AT_KEY)) {
    storage.setItem(PUSH_RSVP_ELIGIBLE_AT_KEY, now.toISOString())
  }
}

export function dismissPushPrompt(
  storage: StorageReaderWriter,
  now = new Date(),
): void {
  const dismissedUntil = new Date(now)
  dismissedUntil.setDate(dismissedUntil.getDate() + PROMPT_COOLDOWN_DAYS)
  storage.setItem(PUSH_DISMISSED_UNTIL_KEY, dismissedUntil.toISOString())
}

export function currentPushPromptDecision(
  storage: Pick<Storage, "getItem">,
  now = new Date(),
): PushPromptDecision {
  return decidePushPrompt({
    supported: isPushSupported(),
    permission: typeof Notification === "undefined" ? "denied" : Notification.permission,
    rsvpEligibleAt: storage.getItem(PUSH_RSVP_ELIGIBLE_AT_KEY),
    dismissedUntil: storage.getItem(PUSH_DISMISSED_UNTIL_KEY),
    isIos: isIosDevice(),
    isStandalone: isStandaloneDisplay(),
    now,
  })
}

export function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - value.length % 4) % 4)
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const decoded = atob(normalized)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

export function buildSubscriptionInput(
  subscription: SerializablePushSubscription,
  userAgent: string | null,
): SavePushSubscriptionInput {
  const serialized = subscription.toJSON()
  const endpoint = serialized.endpoint ?? subscription.endpoint
  const p256dh = serialized.keys?.p256dh
  const auth = serialized.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Browser returned an incomplete Push subscription")
  }
  return { endpoint, p256dh, auth, userAgent }
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!isPushSupported()) throw new Error("Push is not supported in this browser")
  return navigator.serviceWorker.ready
}

export async function currentBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported() || Notification.permission !== "granted") return null
  return (await serviceWorkerRegistration()).pushManager.getSubscription()
}

export async function reconcileBrowserPushSubscription(
  supabase: HuddleBrowserClient,
  vapidPublicKey: string | undefined,
): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== "granted") return false
  const registration = await serviceWorkerRegistration()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    if (!vapidPublicKey) throw new Error("Push configuration is unavailable")
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidPublicKey) as BufferSource,
    })
  }

  await savePushSubscription(
    supabase,
    buildSubscriptionInput(subscription, navigator.userAgent || null),
  )
  window.dispatchEvent(new Event(PUSH_SUBSCRIPTION_CHANGED_EVENT))
  return true
}

export async function enablePushForCurrentBrowser(
  supabase: HuddleBrowserClient,
  vapidPublicKey: string | undefined,
): Promise<NotificationPermission> {
  if (!isPushSupported()) throw new Error("Push is not supported in this browser")
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission
  if (permission === "granted") {
    await reconcileBrowserPushSubscription(supabase, vapidPublicKey)
  }
  return permission
}

export async function disablePushForCurrentBrowser(
  supabase: HuddleBrowserClient,
): Promise<void> {
  const subscription = await currentBrowserPushSubscription()
  if (!subscription) return
  await disablePushSubscription(supabase, subscription.endpoint)
  await subscription.unsubscribe()
  window.dispatchEvent(new Event(PUSH_SUBSCRIPTION_CHANGED_EVENT))
}

