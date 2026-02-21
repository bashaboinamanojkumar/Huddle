"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Calendar, MapPin, Clock, Users, Video, Check, Share2, ChevronLeft, ChevronRight } from "lucide-react"

const filters = ["All Events", "Workshops", "Support Groups", "Social Events", "Guest Speakers", "Virtual", "In-Person"]

const featuredEvent = {
  id: 0,
  name: "Mindfulness & Midterms: Staying Calm Under Pressure",
  date: "March 5, 2026",
  time: "5:00 PM - 6:30 PM EST",
  location: "Virtual (Zoom)",
  host: "Dr. Sarah Chen, UMD Counseling",
  attendees: 34,
  capacity: 50,
  description: "Join us for an interactive workshop on mindfulness techniques specifically designed for exam season. Learn breathing exercises, time management, and self-compassion tools.",
  virtual: true,
}

const events = [
  {
    id: 1, name: "Anxiety Support Circle", type: "Support Groups", date: "Feb 24", time: "4:00 PM",
    location: "Stamp Student Union 2104", host: "Peer Supporters", attendees: 12, capacity: 20,
    tags: ["Anxiety", "Peer-Led"], virtual: false, rsvped: false,
  },
  {
    id: 2, name: "Creative Art Therapy Workshop", type: "Workshops", date: "Feb 25", time: "6:00 PM",
    location: "Virtual (Zoom)", host: "Art Therapy Club", attendees: 28, capacity: 30,
    tags: ["Art", "Wellness"], virtual: true, rsvped: true,
  },
  {
    id: 3, name: "Study Break: Game Night", type: "Social Events", date: "Feb 26", time: "7:00 PM",
    location: "Denton Community Center", host: "Hudrdle Team", attendees: 45, capacity: 60,
    tags: ["Social", "Fun"], virtual: false, rsvped: false,
  },
  {
    id: 4, name: "Understanding Depression: A Student Panel", type: "Guest Speakers", date: "Feb 27", time: "3:00 PM",
    location: "Virtual (Zoom)", host: "Mental Health Terps", attendees: 56, capacity: 100,
    tags: ["Depression", "Panel"], virtual: true, rsvped: false,
  },
  {
    id: 5, name: "Morning Meditation Session", type: "Workshops", date: "Feb 28", time: "8:00 AM",
    location: "McKeldin Mall Lawn", host: "Meditation Circle", attendees: 15, capacity: 40,
    tags: ["Mindfulness", "Morning"], virtual: false, rsvped: false,
  },
  {
    id: 6, name: "LGBTQ+ Support & Chat", type: "Support Groups", date: "Mar 1", time: "5:30 PM",
    location: "Equity Center Rm 1101", host: "LGBTQ+ Equity Center", attendees: 18, capacity: 25,
    tags: ["LGBTQ+", "Support"], virtual: false, rsvped: false,
  },
]

const typeColors: Record<string, string> = {
  "Workshops": "#4A9FD4",
  "Support Groups": "#4ECDC4",
  "Social Events": "#B8A9E3",
  "Guest Speakers": "#FF6B6B",
  "Virtual": "#87CEEB",
  "In-Person": "#1B3A6B",
}

const calendarDays = Array.from({ length: 28 }, (_, i) => {
  const day = i + 1
  const hasEvent = [3, 5, 8, 12, 15, 19, 22, 24, 25, 26, 27, 28].includes(day)
  return { day, hasEvent }
})

export default function EventsPage() {
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("All Events")
  const [view, setView] = useState<"grid" | "calendar" | "list">("grid")
  const [rsvps, setRsvps] = useState<Record<number, boolean>>(
    Object.fromEntries(events.filter(e => e.rsvped).map(e => [e.id, true]))
  )
  const [featuredRsvped, setFeaturedRsvped] = useState(false)

  const toggleRsvp = (id: number) => {
    setRsvps(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filtered = events.filter(e => {
    const matchesFilter =
      activeFilter === "All Events" ||
      e.type === activeFilter ||
      (activeFilter === "Virtual" && e.virtual) ||
      (activeFilter === "In-Person" && !e.virtual)
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy">Upcoming Events & Workshops</h1>
          <p className="mt-1 text-muted-foreground">Live sessions, workshops, and community meetups</p>
        </div>
        <div className="flex gap-2">
          {(["grid", "calendar", "list"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                view === v ? "bg-secondary text-white" : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-card px-4 py-3 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Filters */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === f ? "bg-secondary text-white" : "bg-card text-muted-foreground hover:bg-secondary/10"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Featured Event */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-secondary p-6 text-white shadow-lg"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
              <Calendar className="h-3 w-3" /> Featured Event
            </span>
            <h2 className="mt-3 font-heading text-xl font-bold">{featuredEvent.name}</h2>
            <p className="mt-2 text-sm text-white/80">{featuredEvent.description}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/70">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {featuredEvent.date}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {featuredEvent.time}</span>
              <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" /> {featuredEvent.location}</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {featuredEvent.attendees}/{featuredEvent.capacity} spots</span>
            </div>
            <p className="mt-2 text-xs text-white/60">Hosted by {featuredEvent.host}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setFeaturedRsvped(!featuredRsvped)}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
                featuredRsvped
                  ? "bg-mint text-white"
                  : "bg-coral text-white hover:bg-coral/90"
              }`}
            >
              {featuredRsvped ? (
                <span className="flex items-center gap-1"><Check className="h-4 w-4" /> Going</span>
              ) : "RSVP Now"}
            </button>
            {/* Capacity bar */}
            <div className="w-full">
              <div className="h-1.5 w-full rounded-full bg-white/20">
                <div
                  className="h-1.5 rounded-full bg-mint"
                  style={{ width: `${(featuredEvent.attendees / featuredEvent.capacity) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-center text-[10px] text-white/50">{featuredEvent.capacity - featuredEvent.attendees} spots left</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Calendar View */}
      {view === "calendar" && (
        <div className="mt-6 rounded-2xl bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <button className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="font-heading text-lg font-semibold text-navy">February 2026</h3>
            <button className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Next month">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {calendarDays.map(({ day, hasEvent }) => (
              <div
                key={day}
                className={`flex flex-col items-center justify-center rounded-lg p-2 text-sm transition-colors ${
                  day === 21 ? "bg-secondary/20 font-bold text-secondary" : "hover:bg-muted"
                }`}
              >
                {day}
                {hasEvent && <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-coral" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid / List View */}
      {(view === "grid" || view === "list") && (
        <div className={`mt-6 ${view === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}`}>
          <AnimatePresence>
            {filtered.map(event => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-2xl bg-card shadow-sm ${view === "list" ? "flex items-center gap-4 p-4" : "flex flex-col p-5"}`}
              >
                {view === "grid" && (
                  <>
                    <div className="flex items-start justify-between">
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: typeColors[event.type] || "#4A9FD4" }}
                      >
                        {event.type}
                      </span>
                      {event.virtual ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Video className="h-3 w-3" /> Virtual</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> In-Person</span>
                      )}
                    </div>
                    <h3 className="mt-3 flex-1 text-sm font-semibold text-navy">{event.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Hosted by {event.host}</p>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {event.date} at {event.time}</div>
                      <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location}</div>
                      <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {event.attendees}/{event.capacity} spots</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {event.tags.map(tag => (
                        <span key={tag} className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] text-secondary">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => toggleRsvp(event.id)}
                        className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                          rsvps[event.id]
                            ? "bg-mint/20 text-mint"
                            : "bg-coral text-white hover:bg-coral/90"
                        }`}
                      >
                        {rsvps[event.id] ? (
                          <span className="flex items-center justify-center gap-1"><Check className="h-3 w-3" /> Going</span>
                        ) : "RSVP"}
                      </button>
                      <button className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Share event">
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}

                {view === "list" && (
                  <>
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: typeColors[event.type] || "#4A9FD4" }}>
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-navy">{event.name}</h3>
                      <p className="text-xs text-muted-foreground">{event.date} at {event.time} - {event.location}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{event.attendees}/{event.capacity}</span>
                      <button
                        onClick={() => toggleRsvp(event.id)}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                          rsvps[event.id] ? "bg-mint/20 text-mint" : "bg-coral text-white"
                        }`}
                      >
                        {rsvps[event.id] ? "Going" : "RSVP"}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="mt-12 flex flex-col items-center text-center">
          <Calendar className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-3 font-heading font-semibold text-navy">No events found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}
