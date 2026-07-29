"use client"

import { EventsMap } from "@/components/huddle/events-map"
import { List, Map as MapIcon } from "lucide-react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { Bell, Search, ShieldAlert } from "lucide-react"
import { ActivityCard } from "@/components/huddle/activity-card"

import { useHuddle } from "@/lib/store/huddle-store"
import { categoryMeta } from "@/lib/data/metadata"
import type { Category } from "@/lib/types/huddle"

export default function CommunityPage() {
  const { approvedActivities, currentProfile, universityId } = useHuddle()
  const [category, setCategory] = useState<Category | "all">("all")
  const [date, setDate] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"list" | "map">("list")

  const filtered = useMemo(() => {
    return approvedActivities
      .filter((activity) => {
        const matchesCategory = category === "all" || activity.category === category
        const activityLocalDate = new Date(activity.startTime).toLocaleDateString("en-CA", { timeZone: "America/New_York" })
        const matchesBlock = date === "all" || activityLocalDate === date
        const query = search.trim().toLowerCase()
        const matchesSearch =
          !query ||
          activity.title.toLowerCase().includes(query) ||
          activity.description.toLowerCase().includes(query) ||
          activity.location.name.toLowerCase().includes(query)
        return matchesCategory && matchesBlock && matchesSearch
      })
      .sort((a, b) => {
        const aMatchesCategory = category === "all" || a.category === category
        const bMatchesCategory = category === "all" || b.category === category
        const aMatchesBlock = date === "all" || new Date(a.startTime).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === date
        const bMatchesBlock = date === "all" || new Date(b.startTime).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === date
        const aScore = (aMatchesCategory ? 2 : 0) + (aMatchesBlock ? 1 : 0)
        const bScore = (bMatchesCategory ? 2 : 0) + (bMatchesBlock ? 1 : 0)
        return bScore - aScore
      })
  }, [approvedActivities, date, category, search])

  return (
    <div className="min-h-full bg-background">
      <header className="hero-gradient safe-pt rounded-b-[2.5rem] px-5 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                {universityId === "umb" ? "Huddle UMB" : "Huddle UMD"}
            </p>
            <h1 className="mt-2 font-heading text-3xl font-black leading-none text-white">
              Good to see you, {currentProfile.firstName}.
            </h1>
          </div>
          <Link
            href="/app/profile"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 text-sm font-black text-white"
            style={{ backgroundColor: currentProfile.photoColor }}
            aria-label="Open profile"
          >
            {currentProfile.displayName.charAt(0)}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-3xl bg-black/18 p-3">
            <p className="font-heading text-2xl font-black text-white">{approvedActivities.length}</p>
            <p className="text-[11px] text-white/62">joinable</p>
          </div>
          <div className="rounded-3xl bg-black/18 p-3">
            <p className="font-heading text-2xl font-black text-white">{currentProfile.streakDays}</p>
            <p className="text-[11px] text-white/62">day streak</p>
          </div>
          <div className="rounded-3xl bg-black/18 p-3">
            <p className="font-heading text-2xl font-black text-white">{currentProfile.points}</p>
            <p className="text-[11px] text-white/62">points</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-black/22 px-4 py-2">
          <Search className="h-5 w-5 text-white/48" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activities or locations"
            className="min-h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42"
          />
          <Bell className="h-5 w-5 text-white/48" />
        </div>
      </header>

      <section className="px-5 py-5">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
              category === "all" ? "bg-secondary text-secondary-foreground" : "bg-white/8 text-white/62"
            }`}
          >
            All
          </button>
          {categoryMeta.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                category === item.id ? "bg-secondary text-secondary-foreground" : "bg-white/8 text-white/62"
              }`}
            >
              {item.shortLabel}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setDate("all")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
              date === "all" ? "bg-white text-black" : "bg-white/8 text-white/62"
            }`}
          >
            All dates
          </button>
          {Array.from(
            new Set(
              approvedActivities.map((a) =>
                new Date(a.startTime).toLocaleDateString("en-CA", { timeZone: "America/New_York" })
              )
            )
          )
          .sort()
          .map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
              date === d ? "bg-white text-black" : "bg-white/8 text-white/62"
              }`}
            >
              {new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-black text-white">Best matches</h2>
            <p className="mt-1 text-xs text-white/46">
              Sorted by interests, availability, and comfort.
            </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex h-9 w-9 items-center justify-center rounded-2xl ${view === "list" ? "bg-secondary text-secondary-foreground" : "bg-white/8 text-white/60"}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("map")}
            className={`flex h-9 w-9 items-center justify-center rounded-2xl ${view === "map" ? "bg-secondary text-secondary-foreground" : "bg-white/8 text-white/60"}`}
          >
            <MapIcon className="h-4 w-4" />
          </button>
          <Link href="/crisis" className="flex h-11 w-11 items-center justify-center rounded-full bg-coral/18 text-coral" aria-label="Safety resources">
            <ShieldAlert className="h-5 w-5" />
          </Link>
        </div>
        </div>

        {view === "map" ? (
          <div className="mt-4">
            <EventsMap activities={filtered} />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {filtered.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="glass-card mt-6 rounded-[2rem] p-6 text-center">
            <h3 className="font-heading text-lg font-bold text-white">No matches for this filter</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">
              Clear the filters to see everything happening on campus.
            </p>
            <button
              type="button"
              onClick={() => {
                setCategory("all")
                setDate("all")
                setSearch("")
              }}
              className="mt-4 rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
