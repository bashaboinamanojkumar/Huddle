import { NotificationInbox } from "@/components/notifications/notification-inbox"
import { NotificationInboxSettingsLink } from "@/components/notifications/notification-settings-navigation"

export default function NotificationsPage() {
  return (
    <div className="min-h-full bg-background px-5 py-5">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Inbox</p>
          <h1 className="mt-1 font-heading text-3xl font-black text-white">Notifications</h1>
        </div>
        <NotificationInboxSettingsLink />
      </header>
      <NotificationInbox />
    </div>
  )
}

