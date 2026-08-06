import { createClient as createSupabaseClient } from "@supabase/supabase-js"
// @deno-types="npm:@types/web-push@3.6.4"
import webPush from "web-push"
import {
  buildPushPayload,
  classifyPushResult,
  type PushCategory,
} from "./delivery.ts"

interface RpcResult {
  data: unknown
  error: unknown
}

interface DispatchClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>
}

interface WebPushResponse {
  statusCode?: number
}

interface WebPushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface DispatchDependencies {
  getEnv(name: string): string | undefined
  createClient(url: string, serviceRoleKey: string): DispatchClient
  configureWebPush(subject: string, publicKey: string, privateKey: string): void
  sendNotification(
    subscription: WebPushSubscription,
    payload: string,
  ): Promise<WebPushResponse>
}

interface DeliveryClaim {
  delivery_id: string
  claim_token: string
  notification_id: string
  endpoint: string
  p256dh: string
  auth: string
  url: string
  category: PushCategory
  unread_badge_count: number
}

interface DispatchCounts {
  claimed: number
  sent: number
  deferred: number
  skipped: number
  failed: number
  retrying: number
}

const EMPTY_COUNTS: DispatchCounts = {
  claimed: 0,
  sent: 0,
  deferred: 0,
  skipped: 0,
  failed: 0,
  retrying: 0,
}

function aggregateResponse(counts: DispatchCounts, status = 200): Response {
  return Response.json(counts, {
    status,
    headers: { "cache-control": "no-store" },
  })
}

async function digestSecret(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  )
}

async function secretsMatch(actual: string | null, expected: string): Promise<boolean> {
  const [actualDigest, expectedDigest] = await Promise.all([
    digestSecret(actual ?? ""),
    digestSecret(expected),
  ])
  let difference = actual === null ? 1 : 0
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= actualDigest[index] ^ expectedDigest[index]
  }
  return difference === 0
}

function requiredEnvironment(dependencies: DispatchDependencies): {
  url: string
  serviceRoleKey: string
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
} | null {
  const values = {
    url: dependencies.getEnv("SUPABASE_URL")?.trim(),
    serviceRoleKey: dependencies.getEnv("SUPABASE_SERVICE_ROLE_KEY")?.trim(),
    vapidPublicKey: dependencies.getEnv("VAPID_PUBLIC_KEY")?.trim(),
    vapidPrivateKey: dependencies.getEnv("VAPID_PRIVATE_KEY")?.trim(),
    vapidSubject: dependencies.getEnv("VAPID_SUBJECT")?.trim(),
  }
  return Object.values(values).every(Boolean)
    ? values as Record<keyof typeof values, string>
    : null
}

function statusFromError(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null
  const candidate = error as { statusCode?: unknown; status?: unknown }
  const status = candidate.statusCode ?? candidate.status
  return typeof status === "number" && Number.isInteger(status) ? status : null
}

function errorCodeFor(status: number | null): string {
  return status === null ? "network_error" : `http_${status}`
}

function isClaim(value: unknown): value is DeliveryClaim {
  if (typeof value !== "object" || value === null) return false
  const claim = value as Partial<DeliveryClaim>
  return typeof claim.delivery_id === "string"
    && typeof claim.claim_token === "string"
    && typeof claim.notification_id === "string"
    && typeof claim.endpoint === "string"
    && typeof claim.p256dh === "string"
    && typeof claim.auth === "string"
    && typeof claim.url === "string"
    && typeof claim.category === "string"
    && typeof claim.unread_badge_count === "number"
}

async function recordResult(
  client: DispatchClient,
  claim: DeliveryClaim,
  status: number | null,
): Promise<string | null> {
  const result = await client.rpc("record_notification_delivery_result", {
    p_delivery_id: claim.delivery_id,
    p_claim_token: claim.claim_token,
    p_http_status: status,
    p_error_code: errorCodeFor(status),
  })
  if (result.error || typeof result.data !== "string") return null
  return result.data
}

export async function handleDispatchRequest(
  request: Request,
  dependencies: DispatchDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } })
  }

  const expectedSecret = dependencies.getEnv("NOTIFICATION_DISPATCH_SECRET")?.trim()
  if (!expectedSecret) return aggregateResponse({ ...EMPTY_COUNTS }, 503)

  const authenticated = await secretsMatch(
    request.headers.get("x-dispatch-secret"),
    expectedSecret,
  )
  if (!authenticated) return new Response(null, { status: 401 })

  const environment = requiredEnvironment(dependencies)
  if (!environment) return aggregateResponse({ ...EMPTY_COUNTS }, 503)

  let client: DispatchClient
  try {
    dependencies.configureWebPush(
      environment.vapidSubject,
      environment.vapidPublicKey,
      environment.vapidPrivateKey,
    )
    client = dependencies.createClient(environment.url, environment.serviceRoleKey)
  } catch {
    return aggregateResponse({ ...EMPTY_COUNTS }, 503)
  }

  const claimResult = await client.rpc("claim_notification_deliveries", {
    p_limit: 50,
    p_lease_seconds: 120,
  })
  if (claimResult.error || !Array.isArray(claimResult.data)) {
    return aggregateResponse({ ...EMPTY_COUNTS }, 503)
  }

  const claims = claimResult.data.filter(isClaim)
  const counts: DispatchCounts = {
    ...EMPTY_COUNTS,
    claimed: claimResult.data.length,
    failed: claimResult.data.length - claims.length,
  }

  for (const claim of claims) {
    let httpStatus: number | null
    try {
      const payload = buildPushPayload({
        notificationId: claim.notification_id,
        category: claim.category,
        path: claim.url,
        unreadCount: claim.unread_badge_count,
      })
      const response = await dependencies.sendNotification(
        {
          endpoint: claim.endpoint,
          keys: { p256dh: claim.p256dh, auth: claim.auth },
        },
        JSON.stringify(payload),
      )
      httpStatus = response.statusCode ?? 201
    } catch (error) {
      httpStatus = statusFromError(error)
    }

    const classification = classifyPushResult(httpStatus)
    const state = await recordResult(client, claim, httpStatus)
    if (!state) {
      counts.failed += 1
    } else if (state === "sent") {
      counts.sent += 1
    } else if (state === "skipped") {
      counts.skipped += 1
    } else if (state === "deferred") {
      counts.retrying += 1
    } else if (state === "failed") {
      counts.failed += 1
    } else if (classification === "retry") {
      counts.retrying += 1
    } else {
      counts.failed += 1
    }
  }

  return aggregateResponse(counts)
}

const dependencies: DispatchDependencies = {
  getEnv: (name) => Deno.env.get(name),
  createClient: (url, serviceRoleKey) => createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as DispatchClient,
  configureWebPush: (subject, publicKey, privateKey) => {
    webPush.setVapidDetails(subject, publicKey, privateKey)
  },
  sendNotification: (subscription, payload) => webPush.sendNotification(
    subscription,
    payload,
    { TTL: 60, urgency: "normal" },
  ),
}

if (import.meta.main) {
  Deno.serve((request) => handleDispatchRequest(request, dependencies))
}

