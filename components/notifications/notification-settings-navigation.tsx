import Link from "next/link"
import { ChevronRight, Settings } from "lucide-react"

const notificationSettingsHref = "/app/settings"

export function ProfileNotificationSettingsSection() {
  return (
    <section
      aria-labelledby="notification-settings-heading"
      className="mt-5 glass-card rounded-[2rem] p-5"
    >
      <h2
        id="notification-settings-heading"
        className="font-heading text-lg font-bold text-white"
      >
        Settings
      </h2>
      <Link
        href={notificationSettingsHref}
        className="mt-4 flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3 text-left outline-none transition-colors hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/14 text-secondary">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-white">Notification settings</span>
            <span className="mt-1 block text-xs leading-5 text-white/50">
              Push, quiet hours, and device controls
            </span>
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/44" aria-hidden="true" />
      </Link>
    </section>
  )
}

export function NotificationInboxSettingsLink() {
  return (
    <Link
      href={notificationSettingsHref}
      aria-label="Notification settings"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/8 text-white outline-none transition-colors hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Settings className="h-5 w-5" aria-hidden="true" />
    </Link>
  )
}
