"use client"

import { useEffect, useState } from "react"
import { ViewportDebugPanel } from "@/components/layout/viewport-debug-panel"
import {
  disableAppDiagnostics,
  initializeAppDiagnostics,
  recordAppDiagnostic,
} from "@/lib/debug/app-diagnostics"

const APP_VIEWPORT_CLASS = "app-viewport-locked"
const HEIGHT_PROPERTY = "--app-viewport-height"
const TOP_PROPERTY = "--app-viewport-top"

export function AppViewportController() {
  const [debugEnabled, setDebugEnabled] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const viewport = window.visualViewport
    const passiveListener = { passive: true }
    let animationFrame: number | undefined
    let pendingReason = "mount"

    const measure = () => {
      animationFrame = undefined
      const visualHeight = viewport
        ? viewport.height
        : Number.POSITIVE_INFINITY
      const layoutHeight = Math.max(0, Math.min(
        window.innerHeight,
        document.documentElement.clientHeight,
      ))
      const top = Math.min(
        layoutHeight,
        Math.max(0, viewport ? viewport.offsetTop : 0),
      )
      const height = Math.max(0, Math.min(
        visualHeight,
        layoutHeight - top,
      ))

      root.style.setProperty(HEIGHT_PROPERTY, `${height}px`)
      root.style.setProperty(TOP_PROPERTY, `${top}px`)
      window.scrollTo(0, 0)
      recordAppDiagnostic(`viewport:${pendingReason}`, {
        measuredHeight: height,
        measuredTop: top,
      })
    }

    const schedule = (reason: string) => {
      pendingReason = reason
      if (animationFrame === undefined) {
        animationFrame = window.requestAnimationFrame(measure)
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        schedule("visibility-visible")
      }
    }
    const onPageShow = () => schedule("pageshow")
    const onOrientationChange = () => schedule("orientationchange")
    const onWindowResize = () => schedule("window-resize")
    const onVisualResize = () => schedule("visual-resize")
    const onVisualScroll = () => schedule("visual-scroll")

    const diagnosticsEnabled = initializeAppDiagnostics()
    setDebugEnabled(diagnosticsEnabled)
    if (diagnosticsEnabled) {
      recordAppDiagnostic("diagnostics:enabled")
    }
    root.classList.add(APP_VIEWPORT_CLASS)
    body.classList.add(APP_VIEWPORT_CLASS)
    schedule("mount")

    window.addEventListener("pageshow", onPageShow)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("orientationchange", onOrientationChange)
    window.addEventListener("resize", onWindowResize)
    viewport?.addEventListener("resize", onVisualResize)
    viewport?.addEventListener("scroll", onVisualScroll, passiveListener)

    return () => {
      window.removeEventListener("pageshow", onPageShow)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("orientationchange", onOrientationChange)
      window.removeEventListener("resize", onWindowResize)
      viewport?.removeEventListener("resize", onVisualResize)
      viewport?.removeEventListener("scroll", onVisualScroll)
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame)
      }
      root.classList.remove(APP_VIEWPORT_CLASS)
      body.classList.remove(APP_VIEWPORT_CLASS)
      root.style.removeProperty(HEIGHT_PROPERTY)
      root.style.removeProperty(TOP_PROPERTY)
    }
  }, [])

  if (!debugEnabled) return null

  return (
    <ViewportDebugPanel
      onDisable={() => {
        disableAppDiagnostics()
        setDebugEnabled(false)
      }}
    />
  )
}
