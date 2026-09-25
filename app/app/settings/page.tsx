import { NotificationSettings } from "@/components/notifications/notification-settings"

export default function SettingsPage() {
  return (
    <div className="min-h-full bg-background px-5 py-5">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Preferences</p>
        <h1 className="mt-1 font-heading text-3xl font-black text-white">Notifications</h1>
      </header>
      <NotificationSettings />
    </div>
  )
}
