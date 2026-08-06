"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { submitPulseResponse } from "@/lib/supabase/mutations"
import { fetchOwnPulseResponse } from "@/lib/supabase/queries"
import {
  canSubmitPulse,
  pulseStateCopy,
  type PulsePageStatus,
  validatePulseRating,
} from "@/lib/pulses/model"
import { useHuddle } from "@/lib/store/huddle-store"
import type { PulseResponseView } from "@/lib/types/huddle"

export interface PulsePageViewProps {
  activityTitle: string
  status: PulsePageStatus
  response: PulseResponseView | null
  didMeet: boolean | null
  rating: number | null
  onDidMeetChange: (value: boolean) => void
  onRatingChange: (value: number | null) => void
  onSubmit: () => void
  onRetry: () => void
}

export function PulsePageView({
  activityTitle,
  status,
  response,
  didMeet,
  rating,
  onDidMeetChange,
  onRatingChange,
  onSubmit,
  onRetry,
}: PulsePageViewProps) {
  const pending = status === "submitting"

  return (
    <div className="min-h-full bg-background px-5 py-6">
      <div className="mx-auto max-w-lg">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/65"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Huddles
        </Link>

        <section className="glass-card mt-6 rounded-[2rem] p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint/15">
              <ShieldCheck className="h-5 w-5 text-mint" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-mint">Private pulse</p>
              <h1 className="font-heading text-2xl font-black text-white">{activityTitle}</h1>
            </div>
          </div>

          {status === "loading" || status === "ineligible" ? (
            <p className="mt-6 text-sm leading-6 text-white/65">{pulseStateCopy(status)}</p>
          ) : status === "error" ? (
            <div className="mt-6">
              <p className="text-sm leading-6 text-white/65">{pulseStateCopy(status)}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground"
              >
                Retry
              </button>
            </div>
          ) : status === "stored" && response ? (
            <div className="mt-6 rounded-2xl bg-mint/10 p-4">
              <div className="flex items-center gap-2 font-bold text-mint">
                <CheckCircle2 className="h-5 w-5" />
                {pulseStateCopy(status)}
              </div>
              <p className="mt-3 text-sm text-white">
                {response.didMeet ? "Yes, we met" : "No, we did not meet"}
              </p>
              {response.rating !== null && (
                <p className="mt-1 text-sm text-white/65">Rating: {response.rating}/5</p>
              )}
            </div>
          ) : (
            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
              }}
            >
              <p className="font-heading text-xl font-bold text-white">
                {pulseStateCopy(status)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {([
                  [true, "Yes"],
                  [false, "No"],
                ] as const).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={pending}
                    aria-pressed={didMeet === value}
                    onClick={() => onDidMeetChange(value)}
                    className={`rounded-2xl px-4 py-4 text-sm font-bold disabled:opacity-50 ${
                      didMeet === value
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-white/8 text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="mt-5 block text-sm font-semibold text-white/70">
                Optional rating
                <select
                  value={rating ?? ""}
                  disabled={pending}
                  onChange={(event) =>
                    onRatingChange(event.target.value ? Number(event.target.value) : null)
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white"
                >
                  <option value="">No rating</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>{value}/5</option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={pending || didMeet === null}
                className="mt-5 w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-bold text-secondary-foreground disabled:opacity-50"
              >
                {pending ? pulseStateCopy("submitting") : "Submit response"}
              </button>
            </form>
          )}

          <p className="mt-6 text-xs leading-5 text-white/45">
            Only you can read this response. Confirmed attendance may support Huddle rewards
            when that program launches.
          </p>
        </section>
      </div>
    </div>
  )
}

export default function PulseResponsePage() {
  const params = useParams<{ id: string }>()
  const { activities, currentUserId, hydrated } = useHuddle()
  const activity = activities.find((item) => item.id === params.id)
  const eligible = activity?.userRsvp?.status === "going"
  const [status, setStatus] = useState<PulsePageStatus>("loading")
  const [response, setResponse] = useState<PulseResponseView | null>(null)
  const [didMeet, setDidMeet] = useState<boolean | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [loadVersion, setLoadVersion] = useState(0)

  useEffect(() => {
    let active = true

    if (!hydrated) {
      setStatus("loading")
      return () => { active = false }
    }
    if (!activity || !eligible) {
      setStatus("ineligible")
      return () => { active = false }
    }

    setStatus("loading")
    const supabase = createClient()
    void fetchOwnPulseResponse(supabase, activity.id, currentUserId)
      .then((stored) => {
        if (!active) return
        setResponse(stored)
        setStatus(stored ? "stored" : "unanswered")
      })
      .catch(() => {
        if (active) setStatus("error")
      })

    return () => { active = false }
  }, [activity, currentUserId, eligible, hydrated, loadVersion])

  const submit = useCallback(async () => {
    if (!activity || !eligible || didMeet === null || !canSubmitPulse(response)) return

    setStatus("submitting")
    try {
      const safeRating = validatePulseRating(rating)
      const stored = await submitPulseResponse(
        createClient(),
        activity.id,
        didMeet,
        safeRating,
      )
      setResponse(stored)
      setStatus("stored")
    } catch {
      setStatus("error")
    }
  }, [activity, didMeet, eligible, rating, response])

  return (
    <PulsePageView
      activityTitle={activity?.title ?? "Huddle response"}
      status={status}
      response={response}
      didMeet={didMeet}
      rating={rating}
      onDidMeetChange={setDidMeet}
      onRatingChange={setRating}
      onSubmit={() => void submit()}
      onRetry={() => setLoadVersion((value) => value + 1)}
    />
  )
}
