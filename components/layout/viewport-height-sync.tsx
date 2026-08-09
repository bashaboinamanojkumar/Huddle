"use client"

import { useEffect } from "react"

/**
 * Android standalone PWAs can retain a stale dynamic viewport height after a
 * refresh. Keep the phone frame tied to the currently visible viewport while
 * retaining the CSS vh/dvh fallback for browsers without Visual Viewport.
 */
export function ViewportHeightSync() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const setHeight = () => {
      document.documentElement.style.setProperty(
        "--app-viewport-height",
        `${viewport.height}px`,
      )
    }

    setHeight()
    viewport.addEventListener("resize", setHeight)
    viewport.addEventListener("scroll", setHeight)

    return () => {
      viewport.removeEventListener("resize", setHeight)
      viewport.removeEventListener("scroll", setHeight)
    }
  }, [])

  return null
}
