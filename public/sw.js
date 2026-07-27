const CACHE_NAME = "huddle-shell-v2"
const APP_SHELL = ["/", "/offline", "/icons/icon-192x192.png", "/icons/icon-512x512.png"]

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
