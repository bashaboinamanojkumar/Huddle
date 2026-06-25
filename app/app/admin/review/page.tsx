"use client"

import Link from "next/link"
import { Check, Clock, Flag, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { formatActivityDate, formatActivityTime } from "@/lib/format"
import { useHuddle } from "@/lib/store/huddle-store"
import type { SafetyFlag } from "@/lib/types/huddle"

const flagActions: { status: SafetyFlag["status"]; label: string }[] = [
  { status: "dismissed", label: "Dismiss" },
  { status: "warned", label: "Warn" },
  { status: "removed", label: "Remove" },
  { status: "frozen", label: "Freeze" },
]

export default function ReviewQueuePage() {
  const { pendingActivities, state, resolveFlag, reviewActivity } = useHuddle()
  const openFlags = state.flags.filter((flag) => flag.status === "open")

  return (
    <div className="min-h-full bg-background px-5 py-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Safety owner</p>
        <h1 className="mt-1 font-heading text-3xl font-black text-white">Review queue</h1>
        <p className="mt-2 text-sm leading-6 text-white/58">
          Automation only queues items. Every warning, removal, approval, or freeze is a human action.
        </p>
      </header>

      <section className="mt-5 glass-card rounded-[2rem] p-5">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-secondary" />
          <h2 className="font-heading text-lg font-bold text-white">Pending activities</h2>
        </div>
        <div className="mt-4 space-y-3">
          {pendingActivities.map((activity) => (
            <div key={activity.id} className="rounded-3xl border border-white/10 bg-white/6 p-4">
              <h3 className="font-heading text-base font-bold text-white">{activity.title}</h3>
              <p className="mt-1 text-xs text-white/50">
                {formatActivityDate(activity.startTime)} at {formatActivityTime(activity.startTime)}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/58">{activity.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    reviewActivity(activity.id, "approved")
                    toast.success("Activity approved.")
                  }}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-mint/18 px-4 py-3 text-sm font-bold text-mint"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reviewActivity(activity.id, "rejected")
                    toast("Activity rejected and hidden.")
                  }}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-coral/18 px-4 py-3 text-sm font-bold text-coral"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
          {pendingActivities.length === 0 && (
            <p className="rounded-3xl bg-white/6 p-4 text-sm text-white/54">No pending activities.</p>
          )}
        </div>
      </section>

      <section className="mt-5 glass-card rounded-[2rem] p-5">
        <div className="flex items-center gap-3">
          <Flag className="h-5 w-5 text-coral" />
          <h2 className="font-heading text-lg font-bold text-white">Open flags and reports</h2>
        </div>
        <div className="mt-4 space-y-3">
          {openFlags.map((flag) => (
            <div key={flag.id} className="rounded-3xl border border-white/10 bg-white/6 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-coral/18 px-3 py-1 text-xs font-bold text-coral">{flag.type}</span>
                <span className="text-[11px] text-white/38">{new Date(flag.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/64">{flag.reason}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {flagActions.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => {
                      resolveFlag(flag.id, action.status)
                      toast(`Flag marked ${action.status}.`)
                    }}
                    className="rounded-2xl bg-white/8 px-3 py-3 text-xs font-bold text-white/70"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {openFlags.length === 0 && (
            <p className="rounded-3xl bg-white/6 p-4 text-sm text-white/54">No open safety flags.</p>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] border border-mint/20 bg-mint/10 p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-mint" />
          <p className="text-sm leading-6 text-white/64">
            Response target: review within 24 hours. This pilot UI records manual outcomes, but does not auto-freeze users.
          </p>
        </div>
      </section>

      <Link href="/app/profile" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black">
        Back to profile
      </Link>
    </div>
  )
}
