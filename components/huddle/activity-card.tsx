"use client"

import Link from "next/link"
import { Calendar, MapPin, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { CategoryIcon } from "@/components/huddle/category-icon"
import { formatActivityDate, formatActivityTime, getCategoryMeta } from "@/lib/format"
import { useHuddle } from "@/lib/store/huddle-store"
import type { ActivityView } from "@/lib/types/huddle"

export function ActivityCard({ activity }: { activity: ActivityView }) {
  const { rsvpActivity, leaveActivity } = useHuddle()
  const category = getCategoryMeta(activity.category)
  const isGoing = activity.userRsvp?.status === "going"
  const isWaitlisted = activity.userRsvp?.status === "waitlisted"
  const isFull = activity.seatsLeft === 0 && !isGoing

  const toggleRsvp = () => {
    if (isGoing || isWaitlisted) {
      leaveActivity(activity.id)
      toast("You left this activity.")
      return
    }

    const status = rsvpActivity(activity.id)
    if (status === "going") toast.success("You are going. Chat opens when the group has 2+ students.")
    if (status === "waitlisted") toast("This activity is full, so you joined the waitlist.")
  }

  return (
    <article className="glass-card overflow-hidden rounded-[2rem]">
      <Link href={`/app/activity/${activity.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${category.color}22` }}
            >
              <CategoryIcon category={activity.category} className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{category.shortLabel}</p>
              <h2 className="mt-1 font-heading text-lg font-bold leading-tight text-white">{activity.title}</h2>
            </div>
          </div>
          <div className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
            {activity.fitScore} fit
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/62">{activity.description}</p>

        <div className="mt-4 grid gap-2 text-xs text-white/58">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-secondary" />
            {formatActivityDate(activity.startTime)} at {formatActivityTime(activity.startTime)}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-secondary" />
            {activity.location.name}
          </span>
          <span className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-secondary" />
            {activity.seatsLeft} seats left of {activity.capacity}
          </span>
        </div>

        {activity.sharedInterests.length > 0 && (
          <p className="mt-4 rounded-2xl bg-secondary/12 px-3 py-2 text-xs font-medium text-secondary">
            People who share your interests are going.
          </p>
        )}
      </Link>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <div className="flex -space-x-2">
          {activity.attendees.slice(0, 4).map((attendee) => (
            <span
              key={attendee.userId}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-card text-xs font-bold text-white"
              style={{ backgroundColor: attendee.photoColor }}
              title={attendee.displayName}
            >
              {attendee.displayName.charAt(0)}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleRsvp}
          className={`rounded-2xl px-5 py-3 text-sm font-bold ${
            isGoing
              ? "bg-mint/18 text-mint"
              : isWaitlisted
              ? "bg-white/10 text-white"
              : isFull
              ? "bg-white/10 text-white/70"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {isGoing ? "Going" : isWaitlisted ? "Waitlisted" : isFull ? "Waitlist" : "RSVP"}
        </button>
      </div>
    </article>
  )
}
