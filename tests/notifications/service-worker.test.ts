import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

type WorkerHandler = (event: Record<string, unknown>) => void

function loadWorker() {
  const handlers = new Map<string, WorkerHandler>()
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const setAppBadge = vi.fn().mockResolvedValue(undefined)
  const navigate = vi.fn().mockResolvedValue(undefined)
  const focus = vi.fn().mockResolvedValue(undefined)
  const postMessage = vi.fn()
  const client = {
    url: "https://huddle.example/app",
    navigate,
    focus,
    postMessage,
  }
  const matchAll = vi.fn().mockResolvedValue([client])
  const openWindow = vi.fn().mockResolvedValue(client)
  const subscribe = vi.fn().mockResolvedValue({ endpoint: "private-endpoint" })

  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8")
  runInNewContext(source, {
    URL,
    Response,
    caches: {
      open: vi.fn().mockResolvedValue({
        addAll: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      }),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
      match: vi.fn().mockResolvedValue(undefined),
    },
    fetch: vi.fn().mockRejectedValue(new Error("offline")),
    navigator: { setAppBadge, clearAppBadge: vi.fn().mockResolvedValue(undefined) },
    self: {
      location: { origin: "https://huddle.example" },
      skipWaiting: vi.fn(),
      registration: {
        showNotification,
        pushManager: { subscribe },
      },
      clients: { claim: vi.fn(), matchAll, openWindow },
      addEventListener: (type: string, handler: WorkerHandler) => handlers.set(type, handler),
    },
  })

  return {
    handlers,
    showNotification,
    setAppBadge,
    navigate,
    focus,
    postMessage,
    matchAll,
    openWindow,
    subscribe,
  }
}

async function dispatchWithWait(
  handler: WorkerHandler | undefined,
  event: Record<string, unknown>,
): Promise<void> {
  let work: Promise<unknown> | undefined
  handler?.({
    ...event,
    waitUntil(value: Promise<unknown>) {
      work = value
    },
  })
  await work
}

function payload(category: string) {
  return {
    notificationId: "30000000-0000-4000-8000-000000000001",
    category,
    path: "/app/notifications",
    tag: "huddle-30000000-0000-4000-8000-000000000001",
    unreadCount: 3,
  }
}

describe("notification service worker", () => {
  it("shows privacy-first copy for every supported category", async () => {
    const expected: Record<string, string> = {
      chat: "You have a new Huddle message.",
      activities: "Your Huddle activity has an update.",
      reminders: "You have an upcoming Huddle.",
      social: "You have a new Huddle connection update.",
      safety: "A Huddle safety update is available.",
      digest: "New Huddles are available for you.",
    }
    const worker = loadWorker()

    for (const [category, body] of Object.entries(expected)) {
      await dispatchWithWait(worker.handlers.get("push"), {
        data: { json: () => payload(category) },
      })
      expect(worker.showNotification).toHaveBeenLastCalledWith(
        "Huddle",
        expect.objectContaining({ body, tag: payload(category).tag, renotify: true }),
      )
    }
    expect(worker.setAppBadge).toHaveBeenLastCalledWith(3)
  })

  it("always shows a generic visible notification for malformed payloads", async () => {
    const worker = loadWorker()
    await dispatchWithWait(worker.handlers.get("push"), {
      data: { json: () => ({ ...payload("chat"), senderName: "Private Person" }) },
    })
    expect(worker.showNotification).toHaveBeenCalledWith(
      "Huddle",
      expect.objectContaining({
        body: "You have a new Huddle update.",
        tag: "huddle-update",
        data: { path: "/app/notifications", notificationId: null },
      }),
    )
  })

  it("shows the notification even when a focused client already exists", async () => {
    const worker = loadWorker()
    await dispatchWithWait(worker.handlers.get("push"), {
      data: { json: () => payload("chat") },
    })
    expect(worker.matchAll).not.toHaveBeenCalled()
    expect(worker.showNotification).toHaveBeenCalledOnce()
  })

  it("focuses and navigates an existing client to a validated path", async () => {
    const worker = loadWorker()
    await dispatchWithWait(worker.handlers.get("notificationclick"), {
      notification: {
        data: { path: "/app/chats/one" },
        close: vi.fn(),
      },
    })
    expect(worker.navigate).toHaveBeenCalledWith("/app/chats/one")
    expect(worker.focus).toHaveBeenCalledOnce()
    expect(worker.openWindow).not.toHaveBeenCalled()
  })

  it("falls back to the inbox for a hostile click path", async () => {
    const worker = loadWorker()
    worker.matchAll.mockResolvedValueOnce([])
    await dispatchWithWait(worker.handlers.get("notificationclick"), {
      notification: {
        data: { path: "https://evil.example/steal" },
        close: vi.fn(),
      },
    })
    expect(worker.openWindow).toHaveBeenCalledWith("/app/notifications")
  })

  it("repairs a changed subscription and asks authenticated clients to persist it", async () => {
    const worker = loadWorker()
    const applicationServerKey = new Uint8Array([1, 2, 3])
    await dispatchWithWait(worker.handlers.get("pushsubscriptionchange"), {
      oldSubscription: { options: { applicationServerKey } },
    })
    expect(worker.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey,
    })
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "PUSH_SUBSCRIPTION_CHANGED" })
  })
})

