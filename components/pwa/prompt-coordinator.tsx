"use client"

import { useCallback, useEffect, useState } from "react"
import { BellRing, Settings, X } from "lucide-react"
import {
  InstallGuidance,
  type BeforeInstallPromptEvent,
} from "@/components/pwa/install-prompt"
import { featureFlags } from "@/lib/config/flags"
import { useNotifications } from "@/lib/notifications/notification-provider"
import {
  RSVP_SUCCESS_EVENT,
  currentPushPromptDecision,
  dismissPushPrompt,
  isIosDevice,
  isStandaloneDisplay,
  recordRsvpPushEligibility,
  type PushPromptDecision,
} from "@/lib/notifications/push"

const INSTALL_DISMISSED_KEY = "huddle.install.dismissed"

export function PromptCoordinator() {
  const { enablePush, pushBusy, runtime } = useNotifications()
  const [decision, setDecision] = useState<PushPromptDecision>("hidden")
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setDecision(currentPushPromptDecision(window.localStorage))
  }, [])

  useEffect(() => {
    setInstallDismissed(localStorage.getItem(INSTALL_DISMISSED_KEY) === "true")
    refresh()

    const onRsvp = () => {
      recordRsvpPushEligibility(localStorage)
      refresh()
    }
    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstallEvent(null)
      setInstallDismissed(true)
      refresh()
    }

    window.addEventListener(RSVP_SUCCESS_EVENT, onRsvp)
    window.addEventListener("beforeinstallprompt", onInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener(RSVP_SUCCESS_EVENT, onRsvp)
      window.removeEventListener("beforeinstallprompt", onInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [refresh])

  if (runtime && !runtime.pushEnabled) return null

  const ios = isIosDevice()
  const showInstall = featureFlags.pwaInstallPromptEnabled
    && !isStandaloneDisplay()
    && !installDismissed
    && (decision === "install" || ios || Boolean(installEvent))

  const dismiss = () => {
    setError(null)
    if (showInstall) {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "true")
      setInstallDismissed(true)
    }
    if (decision !== "hidden") {
      dismissPushPrompt(localStorage)
      setDecision("hidden")
    }
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === "accepted") {
      setInstallEvent(null)
      localStorage.setItem(INSTALL_DISMISSED_KEY, "true")
      setInstallDismissed(true)
    }
  }

  const enable = async () => {
    setError(null)
    try {
      const permission = await enablePush()
      setDecision(permission === "denied" ? "denied" : "hidden")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not enable Push")
    }
  }

  if (!showInstall && decision === "hidden") return null

  return (
    <aside className="absolute inset-x-4 bottom-24 z-50 rounded-3xl border border-white/10 bg-black/92 p-4 text-white shadow-2xl backdrop-blur-xl">
      {showInstall ? (
        <InstallGuidance
          isIos={ios}
          installAvailable={Boolean(installEvent)}
          onInstall={() => void install()}
          onDismiss={dismiss}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70"
            aria-label="Dismiss Push prompt"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/18 text-secondary">
              {decision === "denied" ? <Settings className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-sm font-bold">
                {decision === "denied" ? "Push is blocked" : "Get Huddle alerts"}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/60">
                {decision === "denied"
                  ? "Allow notifications in this browser’s site settings, then retry from Huddle settings."
                  : "Get privacy-safe reminders and updates after your first RSVP."}
              </p>
            </div>
          </div>
          {decision === "explain" && (
            <button
              type="button"
              disabled={pushBusy}
              onClick={() => void enable()}
              className="mt-4 w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground disabled:opacity-50"
            >
              {pushBusy ? "Enabling…" : "Enable alerts"}
            </button>
          )}
          {error && <p role="alert" className="mt-3 text-xs text-coral">{error}</p>}
        </>
      )}
    </aside>
  )
}

