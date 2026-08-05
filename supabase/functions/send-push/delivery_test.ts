import {
  buildPushPayload,
  classifyPushResult,
  retryDelaySeconds,
} from "./delivery.ts"
import { handleDispatchRequest } from "./index.ts"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEquals<T>(actual: T, expected: T, message = "values differ") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`)
  }
}

Deno.test("push payload contains only the privacy-safe contract", () => {
  const payload = buildPushPayload({
    notificationId: "30000000-0000-4000-8000-000000000001",
    category: "chat",
    path: "/app/chats/40000000-0000-4000-8000-000000000001",
    unreadCount: 7,
  })

  assertEquals(Object.keys(payload).sort(), [
    "category",
    "notificationId",
    "path",
    "tag",
    "unreadCount",
  ])
  assertEquals(payload.category, "chat")
  assert(!JSON.stringify(payload).includes("sender"), "payload contains sender content")
  assert(!JSON.stringify(payload).includes("body"), "payload contains message content")
})

Deno.test("push payload rejects unsafe application paths", () => {
  for (const path of [
    "https://evil.example/app",
    "//evil.example/app",
    "/settings",
    "/app/../admin",
    "/app/%2e%2e/admin",
  ]) {
    let rejected = false
    try {
      buildPushPayload({
        notificationId: "30000000-0000-4000-8000-000000000001",
        category: "safety",
        path,
        unreadCount: 1,
      })
    } catch {
      rejected = true
    }
    assert(rejected, `unsafe path was accepted: ${path}`)
  }
})

Deno.test("push result classification follows endpoint and retry policy", () => {
  assertEquals(classifyPushResult(201), "sent")
  assertEquals(classifyPushResult(404), "disable")
  assertEquals(classifyPushResult(410), "disable")
  assertEquals(classifyPushResult(429), "retry")
  assertEquals(classifyPushResult(503), "retry")
  assertEquals(classifyPushResult(null), "retry")
  assertEquals(classifyPushResult(400), "permanent")
})

Deno.test("retry delays are bounded exponential steps", () => {
  assertEquals([1, 2, 3, 4, 5].map(retryDelaySeconds), [60, 300, 900, 3600, 3600])
})

Deno.test("missing or invalid dispatch secrets are rejected before client creation", async () => {
  for (const suppliedSecret of [null, "wrong-secret"]) {
    let clientCreated = false
    const response = await handleDispatchRequest(
      new Request("https://edge.example/functions/v1/send-push", {
        method: "POST",
        headers: suppliedSecret ? { "x-dispatch-secret": suppliedSecret } : undefined,
      }),
      {
        getEnv(name) {
          return name === "NOTIFICATION_DISPATCH_SECRET"
            ? "correct-secret-with-production-entropy"
            : "configured"
        },
        createClient() {
          clientCreated = true
          throw new Error("must not create a client")
        },
        configureWebPush() {},
        sendNotification: async () => ({ statusCode: 201 }),
      },
    )

    assertEquals(response.status, 401)
    assertEquals(clientCreated, false)
  }
})

Deno.test("dispatch responses expose aggregate counts only", async () => {
  const response = await handleDispatchRequest(
    new Request("https://edge.example/functions/v1/send-push", {
      method: "POST",
      headers: { "x-dispatch-secret": "correct-secret-with-production-entropy" },
    }),
    {
      getEnv(name) {
        const values: Record<string, string> = {
          NOTIFICATION_DISPATCH_SECRET: "correct-secret-with-production-entropy",
          SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role",
          VAPID_PUBLIC_KEY: "public-key",
          VAPID_PRIVATE_KEY: "private-key",
          VAPID_SUBJECT: "mailto:ops@example.com",
        }
        return values[name]
      },
      createClient() {
        return {
          async rpc(name: string) {
            if (name === "claim_notification_deliveries") return { data: [], error: null }
            throw new Error(`unexpected RPC ${name}`)
          },
        }
      },
      configureWebPush() {},
      sendNotification: async () => ({ statusCode: 201 }),
    },
  )

  assertEquals(response.status, 200)
  const body = await response.json()
  assertEquals(Object.keys(body).sort(), [
    "claimed",
    "deferred",
    "failed",
    "retrying",
    "sent",
    "skipped",
  ])
})

