"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { CalendarClock, CheckCircle2, Flag, MapPin, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { CategoryIcon } from "@/components/huddle/category-icon"
import { availabilityMeta, categoryMeta } from "@/lib/data/seed"
import { featureFlags } from "@/lib/config/flags"
import { useHuddle } from "@/lib/store/huddle-store"
import type { AvailabilityBlock, Category, ComfortSize, SafetyPreference } from "@/lib/types/huddle"

export default function HostPage() {
  const { state, createActivity } = useHuddle()
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [category, setCategory] = useState<Category>("coffee")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [locationId, setLocationId] = useState(state.locations[0]?.id ?? "")
  const [startTime, setStartTime] = useState("")
  const availabilityBlock = useMemo((): AvailabilityBlock => {
        if (!startTime) return "weekday_evening"
        const date = new Date(startTime)
        const day = date.getDay()
        const hour = date.getHours()
        const isWeekend = day === 0 || day === 6
        if (isWeekend) return hour < 12 ? "weekend_morning" : "weekend_afternoon"
        return hour < 12 ? "weekday_morning" : hour < 17 ? "weekday_afternoon" : "weekday_evening"
      }, [startTime])
  const [capacity, setCapacity] = useState(4)
  const [comfortSize, setComfortSize] = useState<ComfortSize>("medium")
  const [safetyPreference, setSafetyPreference] = useState<SafetyPreference>("none")

  const canSubmit =
    title.trim().length >= 3 &&
    title.trim().length <= 80 &&
    description.trim().length > 0 &&
    description.trim().length <= 500 &&
    Boolean(locationId) &&
    Boolean(startTime) &&
    capacity >= 2 &&
    capacity <= 8

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      toast.error("Complete every field and keep limits in range.")
      return
    }

    const activity = createActivity({
      title: title.trim(),
      description: description.trim(),
      category,
      locationId,
      capacity,
      startTime: new Date(startTime).toISOString(),
      availabilityBlock,
      comfortSize,
      safetyPreference,
    })
    setCreatedId(activity.id)
    toast.success("Draft sent to review. It is hidden until approved.")
  }

  return (
    <div className="min-h-full bg-background px-5 py-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Host</p>
        <h1 className="mt-1 font-heading text-3xl font-black text-white">Create a public activity</h1>
        <p className="mt-2 text-sm leading-6 text-white/58">
          User-created events are held for human review before anyone else can see them.
        </p>
      </header>

      {!featureFlags.userCreatedEventsEnabled && (
        <div className="mt-5 rounded-3xl border border-secondary/20 bg-secondary/10 p-4">
          <div className="flex items-start gap-3">
            <Flag className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
            <div>
              <p className="text-sm font-bold text-white">Pilot review mode</p>
              <p className="mt-1 text-xs leading-5 text-white/58">
                The public feed launches with seeded and org activities. Your draft will stay pending for the Safety owner.
              </p>
            </div>
          </div>
        </div>
      )}

      {createdId && (
        <div className="mt-5 rounded-3xl border border-mint/20 bg-mint/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" />
            <div>
              <p className="text-sm font-bold text-white">Pending review</p>
              <p className="mt-1 text-xs leading-5 text-white/58">
                This activity is hidden from other students until the review queue approves it.
              </p>
              <Link href="/app/admin/review" className="mt-3 inline-flex rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black">
                View review queue
              </Link>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-5">
        <section className="glass-card rounded-[2rem] p-5">
          <h2 className="font-heading text-lg font-bold text-white">Category</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {categoryMeta.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`rounded-3xl border p-4 text-left ${
                  category === item.id ? "border-secondary bg-secondary/18" : "border-white/10 bg-white/6"
                }`}
              >
                <CategoryIcon category={item.id} className="h-5 w-5 text-secondary" />
                <span className="mt-3 block text-sm font-bold text-white">{item.shortLabel}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-[2rem] p-5">
          <h2 className="font-heading text-lg font-bold text-white">Details</h2>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-white/46" htmlFor="title">
            Title ({title.length}/80)
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 80))}
            placeholder="Coffee for new Terps"
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 text-sm text-white outline-none placeholder:text-white/34"
          />
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-white/46" htmlFor="description">
            Short description ({description.length}/500)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 500))}
            placeholder="A relaxed public meetup for students who want to meet a few new people."
            className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-white/8 p-4 text-sm text-white outline-none placeholder:text-white/34"
          />
        </section>

        <section className="glass-card rounded-[2rem] p-5">
          <h2 className="font-heading text-lg font-bold text-white">Public location</h2>
          <div className="mt-4 grid gap-3">
            {state.locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => setLocationId(location.id)}
                className={`flex items-start gap-3 rounded-3xl border p-4 text-left ${
                  locationId === location.id ? "border-secondary bg-secondary/18" : "border-white/10 bg-white/6"
                }`}
              >
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                <span>
                  <span className="block text-sm font-bold text-white">{location.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-white/50">{location.safetyNote}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-[2rem] p-5">
          <h2 className="font-heading text-lg font-bold text-white">Time and group</h2>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-white/46" htmlFor="startTime">
            Date and time
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4">
            <CalendarClock className="h-5 w-5 text-secondary" />
            <input
              id="startTime"
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="min-h-12 flex-1 bg-transparent text-sm text-white outline-none"
            />
          </div>

          {/*<h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-white/46">Availability block</h3>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {availabilityMeta.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAvailabilityBlock(item.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                  availabilityBlock === item.id ? "bg-secondary text-secondary-foreground" : "bg-white/8 text-white/62"
                }`}
              >
                {item.shortLabel}
              </button>
            ))}
          </div>*/}

          <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-white/46" htmlFor="capacity">
            Capacity: {capacity}
          </label>
          <input
            id="capacity"
            type="range"
            min={2}
            max={8}
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
            className="mt-3 w-full accent-secondary"
          />

          <div className="mt-5 grid grid-cols-3 gap-2">
            {(["small", "medium", "either"] as ComfortSize[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setComfortSize(item)}
                className={`rounded-2xl px-3 py-3 text-xs font-bold capitalize ${
                  comfortSize === item ? "bg-white text-black" : "bg-white/8 text-white/60"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["none", "mixed", "women_only", "same_gender"] as SafetyPreference[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSafetyPreference(item)}
                className={`rounded-2xl px-3 py-3 text-xs font-bold ${
                  safetyPreference === item ? "bg-white text-black" : "bg-white/8 text-white/60"
                }`}
              >
                {item === "women_only" ? "Same-sex groups" : item === "same_gender" ? "Same-gender" : item}
              </button>
            ))}
          </div>
        </section>

        <div className="rounded-3xl border border-coral/20 bg-coral/10 p-4">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
            <p className="text-xs leading-5 text-white/64">
              Guidelines: public locations only, no alcohol or substance-centered events, minimum group size 2, no protected-group exclusions, and host must attend.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="safe-pb w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-black text-secondary-foreground disabled:opacity-45"
        >
          Send to review
        </button>
      </form>
    </div>
  )
}
