"use client"

import { useEffect } from "react"

const APP_VIEWPORT_CLASS = "app-viewport-locked"
const HEIGHT_PROPERTY = "--app-viewport-height"
const TOP_PROPERTY = "--app-viewport-top"

export function AppViewportController() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const viewport = window.visualViewport
    const passiveListener = { passive: true }
    let animationFrame: number | undefined

    const measure = () => {
      animationFrame = undefined
      const visualHeight = viewport
        ? viewport.height
        : Number.POSITIVE_INFINITY
      const height = Math.max(0, Math.min(
        visualHeight,
        window.innerHeight,
        document.documentElement.clientHeight,
      ))
      const top = Math.max(0, viewport ? viewport.offsetTop : 0)

      root.style.setProperty(HEIGHT_PROPERTY, `${height}px`)
      root.style.setProperty(TOP_PROPERTY, `${top}px`)
      window.scrollTo(0, 0)
    }

    const schedule = () => {
      if (animationFrame === undefined) {
        animationFrame = window.requestAnimationFrame(measure)
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        schedule()
      }
    }

    root.classList.add(APP_VIEWPORT_CLASS)
    body.classList.add(APP_VIEWPORT_CLASS)
    schedule()

    window.addEventListener("pageshow", schedule)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("orientationchange", schedule)
    window.addEventListener("resize", schedule)
    viewport?.addEventListener("resize", schedule)
    viewport?.addEventListener("scroll", schedule, passiveListener)

    return () => {
      window.removeEventListener("pageshow", schedule)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("orientationchange", schedule)
      window.removeEventListener("resize", schedule)
      viewport?.removeEventListener("resize", schedule)
      viewport?.removeEventListener("scroll", schedule)
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame)
      }
      root.classList.remove(APP_VIEWPORT_CLASS)
      body.classList.remove(APP_VIEWPORT_CLASS)
      root.style.removeProperty(HEIGHT_PROPERTY)
      root.style.removeProperty(TOP_PROPERTY)
    }
  }, [])

  return null
}
