"use client"

import { Download, Share, X } from "lucide-react"

export type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallGuidance({
  isIos,
  installAvailable,
  onInstall,
  onDismiss,
}: {
  isIos: boolean
  installAvailable: boolean
  onInstall(): void
  onDismiss(): void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">
        <p className="text-sm font-semibold">Install Huddle</p>
        <p className="mt-1 text-xs text-white/64">
          {isIos
            ? "Install Huddle before enabling Push on iPhone or iPad."
            : "Use Huddle like an app from your home screen."}
        </p>
      </div>
      {isIos && (
        <div className="mt-3 rounded-2xl bg-white/8 p-3 text-xs leading-5 text-white/72">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Share className="h-4 w-4 text-secondary" />
            iPhone / iPad steps
          </div>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Open Huddle in Safari.</li>
            <li>Tap the Share button.</li>
            <li>Choose Add to Home Screen.</li>
            <li>Open the installed Huddle app.</li>
          </ol>
        </div>
      )}
      {installAvailable && (
        <button
          type="button"
          onClick={onInstall}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground"
        >
          <Download className="h-4 w-4" />
          Install app
        </button>
      )}
    </>
  )
}

