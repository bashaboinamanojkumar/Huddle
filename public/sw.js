const CACHE_NAME = "huddle-shell-v3"
const APP_SHELL = ["/", "/offline", "/icons/icon-192x192.png", "/icons/icon-512x512.png"]
const NOTIFICATION_FALLBACK_PATH = "/app/notifications"
const PUSH_PAYLOAD_KEYS = ["category", "notificationId", "path", "tag", "unreadCount"]
const PUSH_COPY = {
  chat: "You have a new Huddle message.",
  activities: "Your Huddle activity has an update.",
  reminders: "You have an upcoming Huddle.",
  social: "You have a new Huddle connection update.",
  safety: "A Huddle safety update is available.",
  digest: "New Huddles are available for you.",
}

function isProtectedUrl(value) {
  const url = new URL(typeof value === "string" ? value : value.url, self.location.origin)
  return (
    url.origin === self.location.origin &&
    (url.pathname === "/app" ||
      url.pathname.startsWith("/app/") ||
      url.pathname === "/onboarding" ||
      url.pathname.startsWith("/onboarding/"))
  )
}

function shouldCache(request) {
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || isProtectedUrl(url.href)) return false

  if (url.pathname.startsWith("/_next/static/")) return true
  if (url.search) return false

  return (
    url.pathname === "/" ||
    url.pathname === "/offline" ||
    url.pathname.startsWith("/icons/")
  )
}

function isSafeApplicationPath(value) {
  if (typeof value !== "string" || value.length < 4 || value.length > 2048) return false
  if (!/^\/app(?:$|[/?#])/.test(value) || value.startsWith("//") || value.includes("\\")) {
    return false
  }
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code <= 32 || code === 127) return false
  }
  const pathname = value.split(/[?#]/, 1)[0]
  return !pathname.includes("//") &&
    !/%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f|25)/i.test(pathname) &&
    !/\/(?:\.|%2e)(?:\.|%2e)?(?:\/|$|%2f)/i.test(pathname)
}

function fallbackPushPayload() {
  return {
    body: "You have a new Huddle update.",
    path: NOTIFICATION_FALLBACK_PATH,
    tag: "huddle-update",
    notificationId: null,
    unreadCount: 0,
  }
}

function validatedPushPayload(data) {
  try {
    const value = data?.json()
    if (!value || typeof value !== "object" || Array.isArray(value)) return fallbackPushPayload()
    if (Object.keys(value).sort().join(",") !== PUSH_PAYLOAD_KEYS.join(",")) {
      return fallbackPushPayload()
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.notificationId)) {
      return fallbackPushPayload()
    }
    if (!Object.prototype.hasOwnProperty.call(PUSH_COPY, value.category)) {
      return fallbackPushPayload()
    }
    if (!isSafeApplicationPath(value.path)) return fallbackPushPayload()
    if (value.tag !== `huddle-${value.notificationId}`) return fallbackPushPayload()
    if (!Number.isInteger(value.unreadCount) || value.unreadCount < 0 || value.unreadCount > 999) {
      return fallbackPushPayload()
    }
    return {
      body: PUSH_COPY[value.category],
      path: value.path,
      tag: value.tag,
      notificationId: value.notificationId,
      unreadCount: value.unreadCount,
    }
  } catch {
    return fallbackPushPayload()
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  if (isProtectedUrl(request)) {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match("/offline")) ??
          new Response("", { status: 503, statusText: "Offline" })
      })
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && shouldCache(request)) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        if (shouldCache(request)) {
          const cached = await caches.match(request)
          if (cached) return cached
        }

        if (request.mode === "navigate") {
          return caches.match("/offline")
        }

        return new Response("", { status: 503, statusText: "Offline" })
      })
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PURGE_PROTECTED_CACHES") return

  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames.map(async (cacheName) => {
          const cache = await caches.open(cacheName)
          const requests = await cache.keys()
          await Promise.all(
            requests
              .filter((request) => isProtectedUrl(request))
              .map((request) => cache.delete(request))
          )
        })
      )
    })
  )
})

self.addEventListener("push", (event) => {
  const payload = validatedPushPayload(event.data)
  event.waitUntil((async () => {
    await self.registration.showNotification("Huddle", {
      body: payload.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: payload.tag,
      renotify: true,
      data: {
        path: payload.path,
        notificationId: payload.notificationId,
      },
    })

    if (typeof navigator !== "undefined" && typeof navigator.setAppBadge === "function") {
      if (payload.unreadCount > 0) await navigator.setAppBadge(payload.unreadCount)
      else if (typeof navigator.clearAppBadge === "function") await navigator.clearAppBadge()
    }
  })())
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const requestedPath = event.notification.data?.path
  const path = isSafeApplicationPath(requestedPath)
    ? requestedPath
    : NOTIFICATION_FALLBACK_PATH

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const client = clients.find((candidate) => {
      try {
        return new URL(candidate.url).origin === self.location.origin
      } catch {
        return false
      }
    })

    if (client) {
      if (typeof client.navigate === "function") await client.navigate(path)
      await client.focus()
      return
    }
    await self.clients.openWindow(path)
  })())
})

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const applicationServerKey = event.oldSubscription?.options?.applicationServerKey
    if (applicationServerKey) {
      try {
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      } catch {
        // The authenticated client performs the same repair after this signal.
      }
    }

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const client of clients) {
      client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED" })
    }
  })())
})
