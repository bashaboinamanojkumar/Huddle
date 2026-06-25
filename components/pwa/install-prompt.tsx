"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import { featureFlags } from "@/lib/config/flags"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!featureFlags.pwaInstallPromptEnabled || isStandalone()) {
      return
    }

    const handler = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handler)

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const alreadyDismissed = window.localStorage.getItem("huddle.install.dismissed") === "true"
    setDismissed(alreadyDismissed)
    setShowIosHint(isIos && !alreadyDismissed)

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (dismissed || (!promptEvent && !showIosHint)) {
    return null
  }

  const dismiss = () => {
    setDismissed(true)
    window.localStorage.setItem("huddle.install.dismissed", "true")
  }

  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
    dismiss()
  }

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-white/10 bg-black/85 p-4 text-white shadow-2xl backdrop-blur-xl">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">
        <p className="text-sm font-semibold">Install Huddle</p>
        <p className="mt-1 text-xs text-white/64">
          Use it like an app from your home screen. {showIosHint ? "On iPhone, tap Share then Add to Home Screen." : "It works offline after your first visit."}
        </p>
      </div>
      {promptEvent && (
        <button
          type="button"
          onClick={install}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground"
        >
          <Download className="h-4 w-4" />
          Install app
        </button>
      )}
    </div>
  )
}
