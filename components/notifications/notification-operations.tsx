import type { Json } from "@/lib/types/database"

export interface NotificationOperationsSummary {
  optedInUsers: number
  activeSubscriptions: number
  disabledSubscriptions: number
  pendingDeliveries: number
  dueDeliveries: number
  processingDeliveries: number
  sentDeliveries: number
  failedDeliveries: number
  retryDeliveries: number
  recentErrors: Array<{ category: string; code: string; count: number }>
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

export function parseNotificationOperations(value: Json | unknown): NotificationOperationsSummary {
  const source = record(value)
  const recentErrors = Array.isArray(source.recent_errors)
    ? source.recent_errors.flatMap((entry) => {
        const error = record(entry)
        if (typeof error.category !== "string" || typeof error.code !== "string") return []
        return [{
          category: error.category.slice(0, 40),
          code: error.code.slice(0, 100),
          count: count(error.count),
        }]
      })
    : []

  return {
    optedInUsers: count(source.opted_in_users),
    activeSubscriptions: count(source.active_subscriptions),
    disabledSubscriptions: count(source.disabled_subscriptions),
    pendingDeliveries: count(source.pending_deliveries),
    dueDeliveries: count(source.due_deliveries),
    processingDeliveries: count(source.processing_deliveries),
    sentDeliveries: count(source.sent_deliveries),
    failedDeliveries: count(source.failed_deliveries),
    retryDeliveries: count(source.retry_deliveries),
    recentErrors,
  }
}

export function NotificationOperationsPanel({
  summary,
}: {
  summary: NotificationOperationsSummary
}) {
  const metrics = [
    ["Opted-in users", summary.optedInUsers],
    ["Active subscriptions", summary.activeSubscriptions],
    ["Disabled subscriptions", summary.disabledSubscriptions],
    ["Pending", summary.pendingDeliveries],
    ["Due", summary.dueDeliveries],
    ["Processing", summary.processingDeliveries],
    ["Sent", summary.sentDeliveries],
    ["Failed", summary.failedDeliveries],
    ["Retrying", summary.retryDeliveries],
  ] as const

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="glass-card rounded-3xl p-4">
            <p className="text-xs text-white/48">{label}</p>
            <p className="mt-1 font-heading text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </section>
      <section className="glass-card rounded-[2rem] p-5">
        <h2 className="font-heading text-lg font-bold text-white">Recent error codes</h2>
        <div className="mt-4 space-y-2">
          {summary.recentErrors.map((error) => (
            <div key={`${error.category}:${error.code}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white/6 px-4 py-3 text-xs">
              <span className="text-white/60">{error.category} · {error.code}</span>
              <span className="font-bold text-white">{error.count}</span>
            </div>
          ))}
          {summary.recentErrors.length === 0 && (
            <p className="text-sm text-white/48">No recent delivery errors.</p>
          )}
        </div>
      </section>
    </div>
  )
}

