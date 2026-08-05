"use client"

import { useEffect, useState } from "react"
import { BellRing, Laptop, Save } from "lucide-react"
import { useNotifications } from "@/lib/notifications/notification-provider"
import type {
  NotificationPreferences,
  NotificationRuntimeConfig,
} from "@/lib/notifications/types"

interface NotificationSettingsViewProps {
  preferences: NotificationPreferences
  runtime: NotificationRuntimeConfig
  saving: boolean
  saved: boolean
  error: string | null
  currentDeviceEnabled: boolean
  deviceControlAvailable: boolean
  onChange(preferences: NotificationPreferences): void
  onSave(): void
  onEnableDevice(): void
  onDisableDevice(): void
}

function formatTime(value: string): string {
  const [hour, minute] = value.split(":").map(Number)
  const date = new Date(2000, 0, 1, hour, minute)
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange(checked: boolean): void
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-white/8 py-4 last:border-0">
      <span>
        <span className="block text-sm font-bold text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-white/48">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-5 w-5 accent-[var(--secondary)]"
      />
    </label>
  )
}

export function NotificationSettingsView({
  preferences,
  runtime,
  saving,
  saved,
  error,
  currentDeviceEnabled,
  deviceControlAvailable,
  onChange,
  onSave,
  onEnableDevice,
  onDisableDevice,
}: NotificationSettingsViewProps) {
  const categoryDisabled = saving || !preferences.pushEnabled || !runtime.pushEnabled
  const categoryRows: Array<{
    key: keyof Pick<NotificationPreferences,
      "chatEnabled" | "activitiesEnabled" | "remindersEnabled" |
      "socialEnabled" | "safetyEnabled" | "digestEnabled">
    label: string
    description: string
  }> = [
    { key: "chatEnabled", label: "Chat", description: "New messages and opened group chats." },
    { key: "activitiesEnabled", label: "Activities", description: "RSVP, review, and waitlist changes." },
    { key: "remindersEnabled", label: "Reminders", description: "Upcoming Huddles and pulse prompts." },
    { key: "socialEnabled", label: "Connections", description: "Friend requests and connection updates." },
    { key: "safetyEnabled", label: "Safety", description: "Private safety status updates." },
    { key: "digestEnabled", label: "Digest", description: "Batched activity matches. Off by default." },
  ]

  return (
    <div className="space-y-5">
      {!runtime.pushEnabled && (
        <p className="rounded-2xl border border-coral/20 bg-coral/10 p-4 text-sm text-white/70">
          Push is temporarily paused. Your in-app inbox remains complete.
        </p>
      )}
      <section className="glass-card rounded-[2rem] p-5">
        <div className="flex items-center gap-3">
          <BellRing className="h-5 w-5 text-secondary" aria-hidden="true" />
          <h2 className="font-heading text-lg font-bold text-white">Push notifications</h2>
        </div>
        <ToggleRow
          label="Allow Push"
          description="Master control for notifications on registered devices."
          checked={preferences.pushEnabled}
          disabled={saving || !runtime.pushEnabled}
          onChange={(checked) => onChange({ ...preferences, pushEnabled: checked })}
        />
        {categoryRows.map((row) => (
          <ToggleRow
            key={row.key}
            label={row.label}
            description={row.description}
            checked={preferences[row.key]}
            disabled={categoryDisabled}
            onChange={(checked) => onChange({ ...preferences, [row.key]: checked })}
          />
        ))}
      </section>

      <section className="glass-card rounded-[2rem] p-5">
        <h2 className="font-heading text-lg font-bold text-white">Quiet hours</h2>
        <p className="mt-1 text-xs text-white/48">
          {formatTime(preferences.quietHoursStart)}–{formatTime(preferences.quietHoursEnd)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-white/60">
            Start
            <input
              type="time"
              value={preferences.quietHoursStart.slice(0, 5)}
              disabled={saving}
              onChange={(event) => onChange({ ...preferences, quietHoursStart: `${event.currentTarget.value}:00` })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"
            />
          </label>
          <label className="text-xs font-bold text-white/60">
            End
            <input
              type="time"
              value={preferences.quietHoursEnd.slice(0, 5)}
              disabled={saving}
              onChange={(event) => onChange({ ...preferences, quietHoursEnd: `${event.currentTarget.value}:00` })}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"
            />
          </label>
        </div>
        <label className="mt-4 block text-xs font-bold text-white/60">
          Timezone
          <select
            value={preferences.timezone}
            disabled={saving}
            onChange={(event) => onChange({ ...preferences, timezone: event.currentTarget.value })}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-3 py-3 text-sm text-white"
          >
            <option value={preferences.timezone}>{preferences.timezone}</option>
            {preferences.timezone !== "America/New_York" && <option value="America/New_York">America/New_York</option>}
            {preferences.timezone !== "UTC" && <option value="UTC">UTC</option>}
          </select>
        </label>
        <label className="mt-4 block text-xs font-bold text-white/60">
          Daily Push cap
          <input
            type="number"
            min={1}
            max={50}
            value={preferences.dailyPushCap}
            disabled={saving}
            onChange={(event) => onChange({ ...preferences, dailyPushCap: Number(event.currentTarget.value) })}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"
          />
          <span className="mt-2 block font-normal text-white/44">{preferences.dailyPushCap} per day</span>
        </label>
      </section>

      <section className="glass-card rounded-[2rem] p-5">
        <div className="flex items-center gap-3">
          <Laptop className="h-5 w-5 text-secondary" aria-hidden="true" />
          <div>
            <h2 className="font-heading text-lg font-bold text-white">Current device</h2>
            <p className="text-xs text-white/48">
              {currentDeviceEnabled ? "Push is enabled on this browser." : "Push is not enabled on this browser."}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!deviceControlAvailable || saving || !runtime.pushEnabled}
          onClick={currentDeviceEnabled ? onDisableDevice : onEnableDevice}
          className="mt-4 w-full rounded-2xl bg-white/8 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {currentDeviceEnabled ? "Disable on this device" : "Enable on this device"}
        </button>
      </section>

      {error && <p role="alert" className="text-sm text-coral">{error}</p>}
      {saved && <p role="status" className="text-sm text-mint">Settings saved.</p>}
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-bold text-black disabled:opacity-50"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  )
}

export function NotificationSettings() {
  const { preferences, runtime, savePreferences } = useNotifications()
  const [draft, setDraft] = useState(preferences)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(preferences), [preferences])

  if (!draft || !runtime) {
    return <p role="status" className="py-12 text-center text-sm text-white/54">Loading notification settings…</p>
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await savePreferences(draft)
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <NotificationSettingsView
      preferences={draft}
      runtime={runtime}
      saving={saving}
      saved={saved}
      error={error}
      currentDeviceEnabled={false}
      deviceControlAvailable={false}
      onChange={(next) => {
        setDraft(next)
        setSaved(false)
      }}
      onSave={() => void save()}
      onEnableDevice={() => undefined}
      onDisableDevice={() => undefined}
    />
  )
}

