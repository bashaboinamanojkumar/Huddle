"use client"

import { useState } from "react"
import { Heart, MessageCircle, Share2, MoreHorizontal, Image, Lock, Tag, Send, Quote } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const moods = [
  { emoji: "\uD83D\uDE1E", label: "Struggling", color: "#FF6B6B" },
  { emoji: "\uD83D\uDE14", label: "Low", color: "#FFB347" },
  { emoji: "\uD83D\uDE10", label: "Okay", color: "#87CEEB" },
  { emoji: "\uD83D\uDE0A", label: "Good", color: "#4ECDC4" },
  { emoji: "\uD83D\uDE04", label: "Great", color: "#4ECDC4" },
]

const posts = [
  {
    id: 1,
    author: "Sarah M.",
    avatar: "S",
    badge: "UMD Junior",
    community: "Anxiety Allies",
    time: "2h ago",
    content: "Had a really tough week with midterms, but reaching out to my peer match helped so much. Remember: it's okay to ask for help.",
    moodTag: "Feeling Hopeful",
    likes: 24,
    hugs: 12,
    comments: 8,
    anonymous: false,
  },
  {
    id: 2,
    author: "Anonymous Terp",
    avatar: "?",
    badge: "UMD Student",
    community: "Depression Support",
    time: "4h ago",
    content: "Some days are harder than others, and today is one of those days. But I'm here, and that counts for something.",
    moodTag: "Feeling Low",
    likes: 45,
    hugs: 31,
    comments: 15,
    anonymous: true,
  },
  {
    id: 3,
    author: "Marcus T.",
    avatar: "M",
    badge: "UMD Senior",
    community: "First-Gen College",
    time: "6h ago",
    content: "Just got accepted into grad school! Four years ago I almost dropped out due to mental health struggles. Never give up on yourself.",
    moodTag: "Feeling Amazing",
    likes: 128,
    hugs: 45,
    comments: 32,
    anonymous: false,
  },
]

const suggestedMatches = [
  { name: "Jamie K.", year: "Junior", interests: ["Music", "Meditation", "Coding"], score: 92 },
  { name: "Anonymous Terp", year: "Sophomore", interests: ["Art", "Yoga", "Reading"], score: 87 },
  { name: "Riley P.", year: "Senior", interests: ["Hiking", "Photography", "Pets"], score: 84 },
]

const upcomingEvents = [
  { name: "Mindfulness Monday", time: "Mon 5:00 PM", attendees: 23 },
  { name: "Stress-Free Study Session", time: "Wed 3:00 PM", attendees: 45 },
  { name: "Peer Support Workshop", time: "Fri 4:00 PM", attendees: 18 },
]

export default function HomeFeed() {
  const [checkedIn, setCheckedIn] = useState(false)
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [feedTab, setFeedTab] = useState("for-you")
  const [postText, setPostText] = useState("")
  const [reactions, setReactions] = useState<Record<number, string[]>>({})

  const handleCheckIn = (index: number) => {
    setSelectedMood(index)
    setCheckedIn(true)
  }

  const toggleReaction = (postId: number, type: string) => {
    setReactions((prev) => {
      const current = prev[postId] || []
      if (current.includes(type)) {
        return { ...prev, [postId]: current.filter((r) => r !== type) }
      }
      return { ...prev, [postId]: [...current, type] }
    })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Feed */}
        <div className="space-y-6">
          {/* Daily Check-In */}
          <div className="rounded-2xl bg-secondary/10 p-6">
            {!checkedIn ? (
              <>
                <h2 className="font-heading text-lg font-semibold text-navy">
                  Good morning, Alex! How are you feeling today?
                </h2>
                <div className="mt-4 flex justify-center gap-4 md:gap-6">
                  {moods.map((mood, i) => (
                    <button
                      key={mood.label}
                      onClick={() => handleCheckIn(i)}
                      className="flex flex-col items-center gap-1.5 transition-transform hover:scale-110"
                    >
                      <span className="text-3xl">{mood.emoji}</span>
                      <span className="text-xs text-muted-foreground">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-3xl">{moods[selectedMood!].emoji}</span>
                <div>
                  <p className="font-medium text-navy">
                    You{"'"}re feeling {moods[selectedMood!].label} today
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Remember: every feeling is valid. You{"'"}re doing great!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Feed Tabs */}
          <Tabs value={feedTab} onValueChange={setFeedTab}>
            <TabsList className="w-full justify-start bg-transparent">
              {["For You", "Following", "Communities", "Trending"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab.toLowerCase().replace(" ", "-")}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-secondary data-[state=active]:text-secondary"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Post Composer */}
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">
                A
              </div>
              <div className="flex-1">
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Share what's on your mind, Alex..."
                  className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  rows={2}
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-2">
                    {[
                      { icon: Image, label: "Photo" },
                      { icon: Tag, label: "Mood" },
                      { icon: Lock, label: "Anonymous" },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <btn.icon className="h-3.5 w-3.5" />
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <button className="rounded-full bg-coral px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-coral/90">
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Posts */}
          {posts.map((post) => (
            <div key={post.id} className="rounded-2xl bg-card p-5 shadow-sm">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: post.anonymous ? "#6B7280" : "#4A9FD4" }}
                  >
                    {post.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-navy">{post.author}</span>
                      <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] text-secondary">
                        {post.badge}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{post.time}</span>
                      <span>in {post.community}</span>
                    </div>
                  </div>
                </div>
                <button className="text-muted-foreground hover:text-navy" aria-label="More options">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <p className="mt-3 leading-relaxed text-foreground">{post.content}</p>

              {/* Mood Tag */}
              {post.moodTag && (
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs text-secondary">
                  {post.moodTag}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-4 border-t border-border pt-3">
                <button
                  onClick={() => toggleReaction(post.id, "heart")}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${
                    reactions[post.id]?.includes("heart") ? "text-coral" : "text-muted-foreground hover:text-coral"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${reactions[post.id]?.includes("heart") ? "fill-coral" : ""}`} />
                  {post.likes + (reactions[post.id]?.includes("heart") ? 1 : 0)}
                </button>
                <button
                  onClick={() => toggleReaction(post.id, "hug")}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${
                    reactions[post.id]?.includes("hug") ? "text-secondary" : "text-muted-foreground hover:text-secondary"
                  }`}
                >
                  <Send className="h-4 w-4" />
                  I feel this ({post.hugs + (reactions[post.id]?.includes("hug") ? 1 : 0)})
                </button>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-navy">
                  <MessageCircle className="h-4 w-4" />
                  {post.comments}
                </button>
                <button className="ml-auto text-muted-foreground transition-colors hover:text-navy">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Sidebar */}
        <div className="hidden space-y-6 lg:block">
          {/* Community Mood */}
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h3 className="font-heading text-sm font-semibold text-navy">Today{"'"}s Mood</h3>
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#D1E3F6" strokeWidth="4" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#4ECDC4" strokeWidth="4" strokeDasharray="54 34" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-mint">54%</span> of Terps are feeling Good or Great today
              </p>
            </div>
          </div>

          {/* Suggested Matches */}
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h3 className="font-heading text-sm font-semibold text-navy">People You Might Connect With</h3>
            <div className="mt-4 space-y-4">
              {suggestedMatches.map((match) => (
                <div key={match.name} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-lavender/30 text-sm font-bold text-navy">
                    {match.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-navy">{match.name}</p>
                    <p className="text-xs text-muted-foreground">{match.year}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {match.interests.map((i) => (
                        <span key={i} className="rounded-full bg-mint/10 px-2 py-0.5 text-[10px] text-mint">
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary transition-colors hover:bg-secondary/20">
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h3 className="font-heading text-sm font-semibold text-navy">Upcoming Events</h3>
            <div className="mt-4 space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.name} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-navy">{event.name}</p>
                    <p className="text-xs text-muted-foreground">{event.time} - {event.attendees} going</p>
                  </div>
                  <button className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary transition-colors hover:bg-secondary/20">
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Inspiration */}
          <div className="rounded-2xl bg-gradient-to-br from-lavender/30 to-secondary/20 p-5">
            <Quote className="h-5 w-5 text-lavender" />
            <p className="mt-2 text-sm leading-relaxed text-navy" style={{ fontFamily: "var(--font-lora)", fontStyle: "italic" }}>
              {'"'}The only way out is through. And the good news is, you don{"'"}t have to go through it alone.{'"'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">- Anonymous Terp</p>
          </div>
        </div>
      </div>
    </div>
  )
}
