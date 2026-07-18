"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Calendar, Flag, MapPin, MessageCircle, ShieldCheck, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { CategoryIcon } from "@/components/huddle/category-icon"
import { formatActivityDate, formatActivityTime, getCategoryMeta } from "@/lib/format"
import { useHuddle } from "@/lib/store/huddle-store"
import { useTerplinkEvents } from "@/hooks/use-terplink-events"

export default function ActivityDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { activities, state, rsvpActivity, leaveActivity, reportSafetyConcern } = useHuddle()
  const { events: terplinkEvents } = useTerplinkEvents()
  const terplinkViews = terplinkEvents.map((event) => ({
    ...event,
    location: state.locations.find((l) => l.id === event.locationId) ?? state.locations[0],
    host: state.profiles[0],
    attendees: [],
    goingCount: 0,
    seatsLeft: event.capacity,
    userRsvp: undefined,
    fitScore: 50,
    sharedInterests: [],
  }))
  const allActivities = [...activities, ...terplinkViews]
  const activity = allActivities.find((item) => item.id === params.id)

  if (!activity) {
    return (
      <div className="flex min-h-full items-center justify-center px-5 text-center">
        <div className="glass-card rounded-[2rem] p-6">
          <h1 className="font-heading text-xl font-bold text-white">Activity not found</h1>
          <Link href="/app" className="mt-4 inline-flex rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground">
            Back to feed
          </Link>
        </div>
      </div>
    )
  }

  const category = getCategoryMeta(activity.category)
  const isGoing = activity.userRsvp?.status === "going"
  const isWaitlisted = activity.userRsvp?.status === "waitlisted"
  const isFull = activity.seatsLeft === 0 && !isGoing
  const chatOpen = activity.goingCount >= 2 && isGoing

  const toggleRsvp = () => {
    if (isGoing || isWaitlisted) {
      leaveActivity(activity.id)
      toast("You left this activity.")
      return
    }
    const status = rsvpActivity(activity.id)
    if (status === "going") {
      toast.success("You are going.")
    }
    if (status === "waitlisted") toast("This activity is full, so you joined the waitlist.")
  }

  const addToCalendar = () => {
    const start = new Date(activity.startTime)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // 1 hour duration
    const format = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(activity.title)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(activity.description)}&location=${encodeURIComponent(activity.location.name)}`
    window.open(url, "_blank")
  }

  const report = () => {
    reportSafetyConcern(`Safety concern reported on activity: ${activity.title}`, activity.hostId)
    toast.success("Report sent to the review queue.")
  }

  return (
    <div className="min-h-full bg-background">
      <header className="hero-gradient safe-pt rounded-b-[2.5rem] px-5 pb-7">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-2 text-sm text-white/70"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/20">
            <CategoryIcon category={activity.category} className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/62">{category.label}</p>
            <h1 className="mt-1 font-heading text-3xl font-black leading-tight text-white">{activity.title}</h1>
          </div>
        </div>
      </header>

      <main className="px-5 py-5">
        <div className="glass-card rounded-[2rem] p-5">
          <p className="text-sm leading-6 text-white/68">{activity.description}</p>
          <div className="mt-5 grid gap-3 text-sm text-white/64">
            <span className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-secondary" />
              {formatActivityDate(activity.startTime)} at {formatActivityTime(activity.startTime)}
            </span>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location.name + " " + activity.location.area + " College Park MD")}`}
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center gap-3 text-secondary underline-offset-2 hover:underline"
              >
                <MapPin className="h-5 w-5 text-secondary" />
                  {activity.location.name}, {activity.location.area}
            </a>
            <span className="flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-secondary" />
              {activity.goingCount}/{activity.capacity} going, {activity.seatsLeft} seats left
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={toggleRsvp}
            className={`rounded-2xl px-4 py-4 text-sm font-bold ${
              isGoing
                ? "bg-mint/18 text-mint"
                : isWaitlisted
                ? "bg-white/10 text-white"
                : isFull
                ? "bg-white/10 text-white"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {isGoing ? "Leave" : isWaitlisted ? "Leave waitlist" : isFull ? "Join waitlist" : "RSVP"}
          </button>
          <Link
            href={chatOpen ? `/app/chats/${activity.id}` : isGoing ? "/app/chats" : "#attendees"}
            className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-bold ${
            chatOpen ? "bg-white text-black" : isGoing ? "bg-white/18 text-white/70" : "bg-white/8 text-white/44"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            {chatOpen ? "Open chat" : isGoing ? "Chat at 2" : "RSVP to chat"}
          </Link>
        </div>

        {isGoing && (
          <button
            type="button"
            onClick={addToCalendar}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-secondary/30 bg-secondary/12 px-4 py-4 text-sm font-bold text-secondary"
          >
            <Calendar className="h-4 w-4" />
              Add to Google Calendar
          </button>
        )}

        <section className="mt-5 glass-card rounded-[2rem] p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-mint" />
            <h2 className="font-heading text-lg font-bold text-white">Public meet-point</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/62">{activity.location.safetyNote}</p>
          <p className="mt-3 rounded-2xl bg-white/8 px-3 py-2 text-xs text-white/52">
            No private residences or free-text addresses are allowed in Phase 1.
          </p>
        </section>

        <section id="attendees" className="mt-5 glass-card rounded-[2rem] p-5">
          <h2 className="font-heading text-lg font-bold text-white">Going</h2>
          <div className="mt-4 space-y-3">
            {activity.attendees.map((attendee) => (
              <div key={attendee.userId} className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: attendee.photoColor }}
                >
                  {attendee.displayName.charAt(0)}
                </span>
                <span className="text-sm font-semibold text-white">{attendee.displayName}</span>
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={report}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-coral/30 bg-coral/12 px-4 py-4 text-sm font-bold text-coral"
        >
          <Flag className="h-4 w-4" />
          Report or safety concern
        </button>
      </main>
    </div>
  )
}
