import {
  NotificationOperationsPanel,
  parseNotificationOperations,
} from "@/components/notifications/notification-operations"
import { createClient } from "@/lib/supabase/server"

export default async function NotificationOperationsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("notification_operations_summary")

  return (
    <div className="min-h-full bg-background px-5 py-5">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Safety owner</p>
        <h1 className="mt-1 font-heading text-3xl font-black text-white">Notification operations</h1>
        <p className="mt-2 text-sm leading-6 text-white/54">
          Aggregate delivery health only. Message content, endpoints, and encryption keys are never shown.
        </p>
      </header>
      {error ? (
        <p className="rounded-2xl border border-coral/20 bg-coral/10 p-4 text-sm text-white/70">
          Notification operations are temporarily unavailable.
        </p>
      ) : (
        <NotificationOperationsPanel summary={parseNotificationOperations(data)} />
      )}
    </div>
  )
}

