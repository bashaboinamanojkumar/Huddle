"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

export function IosInstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches
    const dismissed = localStorage.getItem("ios-banner-dismissed")
    if (isIos && !isInStandaloneMode && !dismissed) {
      setShow(true)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem("ios-banner-dismissed", "true")
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 rounded-3xl border border-white/10 bg-black/90 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Install Huddle on your iPhone</p>
          <p className="mt-1 text-xs leading-5 text-white/62">
            Tap the <span className="font-bold text-secondary">Share</span> button at the bottom of Safari, then tap <span className="font-bold text-secondary">"Add to Home Screen"</span> for the full app experience.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-lg">⬆️</span>
            <span className="text-xs text-white/50">Share → Add to Home Screen</span>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}