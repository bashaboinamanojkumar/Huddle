"use client"

import { useEffect } from "react"

/**
 * `100dvh` isn't consistently honored across real mobile browsers/WebViews, so this
 * measures the actual visible area via the Visual Viewport API and exposes it as a CSS
 * custom property, overriding the dvh/vh fallback chain in globals.css whenever available.
 */
export function ViewportHeightSync() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const setHeight = () => {
      document.documentElement.style.setProperty("--app-viewport-height", `${viewport.height}px`)
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
