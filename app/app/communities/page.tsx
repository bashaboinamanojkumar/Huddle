"use client"

import { useState } from "react"
import { Search, Users, MessageCircle, Zap, Check } from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

const filters = ["All", "My Communities", "Academic", "Identity", "Mental Health", "Interests", "Crisis Support"]

const featuredCommunities = [
  {
    name: "Anxiety Allies",
    description: "A safe space for students navigating anxiety together.",
    members: 342,
    postsToday: 28,
    gradient: "from-secondary/20 to-sky/20",
    tags: ["Anxiety", "Support", "Coping"],
    icon: "shield",
    joined: true,
  },
  {
    name: "First-Gen College",
    description: "Support for first-generation college students at UMD.",
    members: 215,
    postsToday: 12,
    gradient: "from-lavender/20 to-secondary/20",
    tags: ["Identity", "Support", "Academic"],
    icon: "star",
    joined: false,
  },
  {
    name: "Mindful Gaming",
    description: "Gaming meets mental wellness. Chill sessions and check-ins.",
    members: 178,
    postsToday: 45,
    gradient: "from-mint/20 to-secondary/20",
    tags: ["Gaming", "Wellness", "Fun"],
    icon: "gamepad",
    joined: false,
  },
]

const communities = [
  { name: "Finals Support", members: 523, description: "Survive and thrive through exam season", tags: ["Academic", "Stress", "Study"], activity: "Buzzing", color: "#4A9FD4", joined: false },
  { name: "Pre-Med Struggles", members: 189, description: "For pre-med students needing a safe vent space", tags: ["Academic", "Pre-Med", "Support"], activity: "Active", color: "#B8A9E3", joined: true },
  { name: "LGBTQ+ Terps", members: 412, description: "Celebrate identity and find your community", tags: ["Identity", "LGBTQ+", "Support"], activity: "Buzzing", color: "#4ECDC4", joined: false },
  { name: "International Students", members: 267, description: "Navigating UMD life away from home", tags: ["Identity", "International", "Culture"], activity: "Active", color: "#87CEEB", joined: false },
  { name: "Depression Support", members: 298, description: "You're not alone. Talk it out.", tags: ["Mental Health", "Depression", "Support"], activity: "Active", color: "#FF6B6B", joined: true },
  { name: "Meditation Circle", members: 156, description: "Guided meditations and mindfulness practices", tags: ["Wellness", "Meditation", "Calm"], activity: "Quiet", color: "#B8A9E3", joined: false },
  { name: "Sleep Better", members: 201, description: "Tips and support for better sleep habits", tags: ["Wellness", "Sleep", "Health"], activity: "Active", color: "#87CEEB", joined: false },
  { name: "Art Therapy Corner", members: 134, description: "Express yourself through creative arts", tags: ["Interest", "Art", "Therapy"], activity: "Active", color: "#4ECDC4", joined: false },
  { name: "Engineering Solidarity", members: 345, description: "Engineers supporting engineers through it all", tags: ["Academic", "Engineering", "Support"], activity: "Buzzing", color: "#4A9FD4", joined: false },
]

export default function CommunitiesPage() {
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>(
    Object.fromEntries([...featuredCommunities, ...communities].map((c) => [c.name, c.joined]))
  )

  const toggleJoin = (name: string) => {
    setJoinedMap((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const filteredCommunities = communities.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (activeFilter === "My Communities") return joinedMap[c.name]
    if (activeFilter !== "All" && !c.tags.some((t) => t.toLowerCase().includes(activeFilter.toLowerCase()))) return false
    return true
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold text-navy md:text-3xl">Find Your Community</h1>
        <p className="text-muted-foreground">Safe, moderated spaces for every experience</p>

        <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search communities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === f
                  ? "bg-navy text-white"
                  : "bg-muted text-muted-foreground hover:bg-secondary/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Communities */}
      <div className="mt-8">
        <h2 className="font-heading text-lg font-semibold text-navy">Featured</h2>
        <ScrollArea className="mt-4 w-full">
          <div className="flex gap-4 pb-4">
            {featuredCommunities.map((community) => (
              <div
                key={community.name}
                className={`min-w-[300px] flex-shrink-0 rounded-2xl bg-gradient-to-br ${community.gradient} p-6`}
              >
                <h3 className="font-heading text-lg font-semibold text-navy">{community.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{community.members} members</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{community.postsToday} today</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {community.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/60 px-2.5 py-0.5 text-[10px] font-medium text-navy">{tag}</span>
                  ))}
                </div>
                <button
                  onClick={() => toggleJoin(community.name)}
                  className={`mt-4 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    joinedMap[community.name]
                      ? "bg-mint/20 text-mint"
                      : "bg-coral text-white hover:bg-coral/90"
                  }`}
                >
                  {joinedMap[community.name] ? (
                    <span className="flex items-center gap-1"><Check className="h-4 w-4" /> Joined</span>
                  ) : "Join"}
                </button>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Community Grid */}
      <div className="mt-8">
        <h2 className="font-heading text-lg font-semibold text-navy">All Communities</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCommunities.map((community) => (
            <div key={community.name} className="rounded-2xl bg-card shadow-sm overflow-hidden">
              <div className="h-2" style={{ backgroundColor: community.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-heading text-base font-semibold text-navy">{community.name}</h3>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    community.activity === "Buzzing" ? "bg-mint/10 text-mint" :
                    community.activity === "Active" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                  }`}>
                    <Zap className="h-2.5 w-2.5" />
                    {community.activity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {community.members} members
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {community.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                  ))}
                </div>
                <button
                  onClick={() => toggleJoin(community.name)}
                  className={`mt-4 w-full rounded-xl py-2 text-sm font-semibold transition-colors ${
                    joinedMap[community.name]
                      ? "bg-muted text-muted-foreground"
                      : "bg-secondary/10 text-secondary hover:bg-secondary/20"
                  }`}
                >
                  {joinedMap[community.name] ? "Joined" : "Join Community"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
