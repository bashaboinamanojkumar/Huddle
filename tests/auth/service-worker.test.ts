import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

type WorkerHandler = (event: Record<string, unknown>) => void

function loadWorker() {
  const handlers = new Map<string, WorkerHandler>()
  const addAll = vi.fn().mockResolvedValue(undefined)
  const deleteEntry = vi.fn().mockResolvedValue(true)
  const cache = {
    addAll,
    put: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([
      new Request("https://hurdle.example/app"),
      new Request("https://hurdle.example/icons/icon-192x192.png"),
    ]),
    delete: deleteEntry,
  }
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(["huddle-shell-v1", "huddle-shell-v2"]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn(async (request: Request | string) => {
      const url = typeof request === "string" ? request : new URL(request.url).pathname
      if (url === "/offline") return new Response("offline")
      if (url === "/app") return new Response("private cached page")
      return undefined
    }),
  }

  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8")
  runInNewContext(source, {
    URL,
    Response,
    caches,
    fetch: vi.fn().mockRejectedValue(new Error("offline")),
    self: {
      location: { origin: "https://hurdle.example" },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
      addEventListener: (type: string, handler: WorkerHandler) => {
        handlers.set(type, handler)
      },
    },
  })

  return { handlers, addAll, deleteEntry }
}

describe("service worker authentication boundaries", () => {
  it("does not pre-cache a protected application page", async () => {
    const { handlers, addAll } = loadWorker()
    let installWork: Promise<unknown> | undefined

    handlers.get("install")?.({
      waitUntil: (work: Promise<unknown>) => {
        installWork = work
      },
    })
    await installWork

    expect(addAll).toHaveBeenCalledOnce()
    expect(addAll.mock.calls[0][0]).not.toContain("/app")
    expect(addAll).toHaveBeenCalledWith([
      "/",
      "/offline",
      "/icons/huddle-app-v1-192.png",
      "/icons/huddle-app-maskable-v1-192.png",
      "/icons/huddle-app-v1-512.png",
      "/icons/huddle-app-maskable-v1-512.png",
    ])
  })

  it("never serves a cached protected page while offline", async () => {
    const { handlers } = loadWorker()
    let response: Promise<Response> | undefined

    handlers.get("fetch")?.({
      request: new Request("https://hurdle.example/app", { method: "GET" }),
      respondWith: (work: Promise<Response>) => {
        response = work
      },
    })

    expect(await (await response)?.text()).toBe("offline")
  })

  it("purges protected entries when the client signs out", async () => {
    const { handlers, deleteEntry } = loadWorker()
    let messageWork: Promise<unknown> | undefined

    handlers.get("message")?.({
      data: { type: "PURGE_PROTECTED_CACHES" },
      waitUntil: (work: Promise<unknown>) => {
        messageWork = work
      },
    })
    await messageWork

    expect(deleteEntry).toHaveBeenCalledTimes(2)
    expect(
      deleteEntry.mock.calls.every(
        ([request]) => new URL((request as Request).url).pathname === "/app"
      )
    ).toBe(true)
  })
})
