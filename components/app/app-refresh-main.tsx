"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from "react"
import { ArrowDown, LoaderCircle } from "lucide-react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import {
  calculatePull,
  isPullStartEligible,
} from "@/components/app/pull-to-refresh-model"
import { recordAppDiagnostic } from "@/lib/debug/app-diagnostics"
import { useHuddle } from "@/lib/store/huddle-store"

const AUTOMATIC_REFRESH_THROTTLE_MS = 30_000
const REFRESHING_PULL_DISTANCE_PX = 48
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, [contenteditable]:not([contenteditable='false'])"

type RefreshPhase = "idle" | "pulling" | "armed" | "refreshing"

interface PullGesture {
  active: boolean
  armed: boolean
  startX: number
  startY: number
}

const IDLE_GESTURE: PullGesture = {
  active: false,
  armed: false,
  startX: 0,
  startY: 0,
}

export function AppRefreshMain({ children }: { children: React.ReactNode }) {
  const { refresh } = useHuddle()
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)
  const gestureRef = useRef<PullGesture>({ ...IDLE_GESTURE })
  const phaseRef = useRef<RefreshPhase>("idle")
  const pathnameRef = useRef(pathname)
  const lastAutomaticAttemptRef = useRef(0)
  const automaticRefreshCountRef = useRef(0)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [phase, setPhase] = useState<RefreshPhase>("idle")
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const updatePhase = useCallback((nextPhase: RefreshPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const setPullDistance = useCallback((distance: number, settle = false) => {
    const main = mainRef.current
    if (!main) return

    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    main.classList.toggle("pull-to-refresh-settling", settle)
    main.style.setProperty("--pull-distance", `${distance}px`)

    if (settle) {
      settleTimerRef.current = setTimeout(() => {
        main.classList.remove("pull-to-refresh-settling")
        settleTimerRef.current = null
      }, 240)
    }
  }, [])

  const resetGesture = useCallback((settle = true) => {
    gestureRef.current = { ...IDLE_GESTURE }
    if (phaseRef.current !== "refreshing") {
      updatePhase("idle")
    }
    setPullDistance(0, settle)
  }, [setPullDistance, updatePhase])

  const runManualRefresh = useCallback(async () => {
    if (phaseRef.current === "refreshing") return

    gestureRef.current = { ...IDLE_GESTURE }
    updatePhase("refreshing")
    setAnnouncement("Refreshing content")
    setPullDistance(REFRESHING_PULL_DISTANCE_PX, true)
    recordAppDiagnostic("refresh:manual-start")

    try {
      await refresh()
      setAnnouncement("Content updated")
      recordAppDiagnostic("refresh:manual-success")
    } catch {
      setAnnouncement("Could not refresh content")
      recordAppDiagnostic("refresh:manual-failure")
      toast.error("Couldn't refresh. Check your connection and try again.")
    } finally {
      updatePhase("idle")
      setPullDistance(0, true)
    }
  }, [refresh, setPullDistance, updatePhase])

  const runAutomaticRefresh = useCallback(async (
    reason: "visibility" | "pageshow" | "online",
    bypassThrottle: boolean,
  ) => {
    if (!navigator.onLine) {
      recordAppDiagnostic("refresh:auto-skipped", { reason, skipped: "offline" })
      return
    }

    const now = Date.now()
    if (
      !bypassThrottle
      && now - lastAutomaticAttemptRef.current < AUTOMATIC_REFRESH_THROTTLE_MS
    ) {
      recordAppDiagnostic("refresh:auto-skipped", { reason, skipped: "throttled" })
      return
    }
    if (!bypassThrottle) {
      lastAutomaticAttemptRef.current = now
    }

    const main = mainRef.current
    const routeAtStart = pathnameRef.current
    const scrollTop = main?.scrollTop ?? 0
    recordAppDiagnostic("refresh:auto-start", { reason, savedScrollTop: scrollTop })
    automaticRefreshCountRef.current += 1

    try {
      await refresh()
      recordAppDiagnostic("refresh:auto-success", { reason })
      if (main && pathnameRef.current === routeAtStart && scrollTop > 0) {
        window.requestAnimationFrame(() => {
          main.scrollTop = Math.min(
            scrollTop,
            Math.max(0, main.scrollHeight - main.clientHeight),
          )
        })
      }
    } catch {
      recordAppDiagnostic("refresh:auto-failure", { reason })
      // Automatic refresh keeps the current snapshot and retries on a later lifecycle event.
    } finally {
      automaticRefreshCountRef.current = Math.max(
        0,
        automaticRefreshCountRef.current - 1,
      )
    }
  }, [refresh])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runAutomaticRefresh("visibility", false)
      }
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void runAutomaticRefresh("pageshow", false)
      }
    }
    const onOnline = () => void runAutomaticRefresh("online", true)

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pageshow", onPageShow)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pageshow", onPageShow)
      window.removeEventListener("online", onOnline)
    }
  }, [runAutomaticRefresh])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    const onTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current
      if (!gesture.active) return
      if (main.scrollTop > 0 || event.touches.length !== 1) {
        recordAppDiagnostic("pull:cancel", {
          reason: main.scrollTop > 0 ? "scrolled" : "multitouch",
        })
        resetGesture()
        return
      }

      const touch = event.touches[0]
      const measurement = calculatePull({
        deltaX: touch.clientX - gesture.startX,
        deltaY: touch.clientY - gesture.startY,
        touchCount: event.touches.length,
      })
      if (measurement.cancelled) {
        recordAppDiagnostic("pull:cancel", { reason: "direction" })
        resetGesture()
        return
      }
      if (measurement.distance <= 0) return

      event.preventDefault()
      setPullDistance(measurement.distance)
      gesture.armed = measurement.armed
      const nextPhase: RefreshPhase = measurement.armed ? "armed" : "pulling"
      if (phaseRef.current !== nextPhase) {
        recordAppDiagnostic(`pull:${nextPhase}`, { distance: measurement.distance })
        updatePhase(nextPhase)
      }
    }

    main.addEventListener("touchmove", onTouchMove, { passive: false })
    return () => main.removeEventListener("touchmove", onTouchMove)
  }, [resetGesture, setPullDistance, updatePhase])

  useEffect(() => () => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current)
    }
  }, [])

  const onTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const main = mainRef.current
    if (gestureRef.current.active && event.touches.length !== 1) {
      recordAppDiagnostic("pull:cancel", { reason: "multitouch" })
      resetGesture()
      return
    }
    const target = event.target instanceof Element ? event.target : null
    const interactiveTarget = Boolean(target?.closest(INTERACTIVE_SELECTOR))
    if (!main || !isPullStartEligible({
      scrollTop: main.scrollTop,
      touchCount: event.touches.length,
      refreshing: phaseRef.current === "refreshing"
        || automaticRefreshCountRef.current > 0,
      interactiveTarget,
    })) {
      return
    }

    const touch = event.touches[0]
    main.classList.remove("pull-to-refresh-settling")
    gestureRef.current = {
      active: true,
      armed: false,
      startX: touch.clientX,
      startY: touch.clientY,
    }
    recordAppDiagnostic("pull:start", { mainScrollTop: main.scrollTop })
    updatePhase("pulling")
  }

  const onTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    if (!gestureRef.current.active) return
    if (event.touches.length > 0) {
      recordAppDiagnostic("pull:cancel", { reason: "multitouch" })
      resetGesture()
      return
    }
    const shouldRefresh = gestureRef.current.armed
    gestureRef.current = { ...IDLE_GESTURE }
    if (shouldRefresh) {
      recordAppDiagnostic("pull:release", { outcome: "refresh" })
      void runManualRefresh()
    } else {
      recordAppDiagnostic("pull:release", { outcome: "cancel" })
      resetGesture()
    }
  }

  return (
    <main
      ref={mainRef}
      data-refresh-phase={phase}
      className="authenticated-main relative min-h-0 flex-1 overflow-y-auto"
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => resetGesture()}
      aria-busy={phase === "refreshing"}
    >
      <button
        type="button"
        aria-label="Refresh content"
        onClick={() => void runManualRefresh()}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-1/2 focus:z-50 focus:-translate-x-1/2 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black"
      >
        Refresh content
      </button>
      <div className="pull-to-refresh-indicator" aria-hidden="true">
        {phase === "refreshing" ? (
          <LoaderCircle className="pull-to-refresh-spinner h-5 w-5 animate-spin" />
        ) : (
          <ArrowDown className="pull-to-refresh-arrow h-5 w-5" />
        )}
      </div>
      <div className="pull-to-refresh-content">{children}</div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </main>
  )
}
