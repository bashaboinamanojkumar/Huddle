"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Award, CalendarHeart, GraduationCap, UserCheck, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { getCategoryMeta } from "@/lib/format"
import { useHuddle } from "@/lib/store/huddle-store"
import { CategoryIcon } from "@/components/huddle/category-icon"


const statusLabels: Record<string, string> = {
  undergrad_1: "Freshman",
  undergrad_2: "Sophomore",
  undergrad_3: "Junior",
  undergrad_4: "Senior",
  masters: "Master's Student",
  phd: "PhD Student",
  postdoc: "Postdoc",
  other: "Student",
}

const badges = [
  { id: "first_rsvp", label: "First Huddle", emoji: "🎉", condition: (points: number) => points >= 10 },
  { id: "three_streak", label: "3 Day Streak", emoji: "🔥", condition: (_: number, streak: number) => streak >= 3 },
  { id: "five_meetups", label: "5 Meetups", emoji: "🌊", condition: (points: number) => points >= 50 },
  { id: "wavelength", label: "Same Wavelength", emoji: "〰️", condition: (points: number) => points >= 80 },
  { id: "community", label: "Community Builder", emoji: "🤝", condition: (points: number) => points >= 100 },
  { id: "study_buddy", label: "Study Buddy", emoji: "📚", condition: (points: number) => points >= 30 },
]

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const {
    state,
    currentUserId,
    approvedActivities,
    hydrated,
    loadProfile,
    addFriend,
    acceptFriend,
    declineFriend,
    unfriend,
    sendDirectMessage,
  } = useHuddle()

  const profile = state.profiles.find((p) => p.userId === params.id)
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "not-found" | "error">("idle")
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (profile) {
      setLoadStatus("ready")
      return
    }
    if (!hydrated) return

    let active = true
    setLoadStatus("loading")
    void loadProfile(params.id)
      .then((loaded) => {
        if (active) setLoadStatus(loaded ? "ready" : "not-found")
      })
      .catch(() => {
        if (active) setLoadStatus("error")
      })
    return () => {
      active = false
    }
  }, [hydrated, loadProfile, params.id, profile, retryToken])

  const friendConnection = useMemo(
    () => state.friends.find(
      (f) => (f.userId === currentUserId && f.friendId === params.id) ||
              (f.userId === params.id && f.friendId === currentUserId)
    ),
    [state.friends, currentUserId, params.id]
  )

  const isAccepted = friendConnection?.status === "accepted"
  const isPending = friendConnection?.status === "pending"
  const isIncoming = isPending && friendConnection?.userId === params.id
  const isOutgoing = isPending && friendConnection?.userId === currentUserId

  const [dmBody, setDmBody] = useState("")
  const [showDm, setShowDm] = useState(false)
  const [friendMessage, setFriendMessage] = useState("")
  const [showFriendMsg, setShowFriendMsg] = useState(false)
  const sharedInterests = useMemo(() => {
    const myProfile = state.profiles.find((p) => p.userId === currentUserId)
    if (!myProfile || !profile) return []
    return profile.interests.filter((i) => myProfile.interests.includes(i))
  }, [state.profiles, currentUserId, profile, params.id])

  const theirActivities = useMemo(
    () => approvedActivities.filter((a) =>
      a.attendees.some((att) => att.userId === params.id)
    ),
    [approvedActivities, params.id]
  )

  const earnedBadges = useMemo(
    () => profile ? badges.filter((b) => b.condition(profile.points, profile.streakDays)) : [],
    [profile]
  )

  if (!profile) {
    if (!hydrated || loadStatus === "idle" || loadStatus === "loading" || loadStatus === "ready") {
      return (
        <div className="flex min-h-full items-center justify-center px-5 text-sm text-white/58" role="status">
          Loading profile…
        </div>
      )
    }

    return (
      <div className="flex min-h-full items-center justify-center px-5 text-center">
        <div className="glass-card rounded-[2rem] p-6">
          <h1 className="font-heading text-xl font-bold text-white">
            {loadStatus === "error" ? "Could not load profile" : "Profile not found"}
          </h1>
          {loadStatus === "error" && (
            <button
              type="button"
              onClick={() => setRetryToken((value) => value + 1)}
              className="mt-4 inline-flex rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white"
            >
              Retry profile
            </button>
          )}
          <Link href="/app" className="mt-4 inline-flex rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground">
            Back to feed
          </Link>
        </div>
      </div>
    )
  }

  const isMe = profile.userId === currentUserId

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

        <div className="flex items-center gap-4">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-black text-white border-4 border-white/20"
            style={{ backgroundColor: profile.photoColor }}
          >
            {profile.displayName.charAt(0)}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-black text-white">{profile.displayName}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/62">
              <GraduationCap className="h-4 w-4" />
              {statusLabels[profile.status] ?? "Student"}
            </div>
            {sharedInterests.length > 0 && (
              <div className="mt-1 flex items-center gap-1">
                <img src="/icons/categories/same-wavelength.png" alt="same wavelength" className="h-4 w-4 object-contain" style={{ mixBlendMode: "screen" }} />
                <p className="text-xs text-secondary font-semibold">
                  Same wavelength on {sharedInterests.length} interest{sharedInterests.length > 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-3xl bg-black/18 p-3 text-center">
            <p className="font-heading text-2xl font-black text-white">{profile.points}</p>
            <p className="text-[11px] text-white/62">points</p>
          </div>
          <div className="rounded-3xl bg-black/18 p-3 text-center">
            <p className="font-heading text-2xl font-black text-white">{profile.streakDays}</p>
            <p className="text-[11px] text-white/62">day streak</p>
          </div>
          <div className="rounded-3xl bg-black/18 p-3 text-center">
            <p className="font-heading text-2xl font-black text-white">{profile.meetupsThisWeek}</p>
            <p className="text-[11px] text-white/62">meetups</p>
          </div>
        </div>

        {!isMe && (
          <div className="mt-5">
            {isAccepted && (
              <div className="space-y-2">
                {showDm && (
                  <div className="flex gap-2">
                    <input
                      value={dmBody}
                      onChange={(e) => setDmBody(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-white/34"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!dmBody.trim()) return
                        try {
                          await sendDirectMessage(profile.userId, dmBody.trim())
                          toast.success("Message sent!")
                          setDmBody("")
                          setShowDm(false)
                        } catch {
                          toast.error("Could not send message.")
                        }
                      }}
                      className="rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground"
                    >
                      Send
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDm(!showDm)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground"
                  >
                    <UserCheck className="h-4 w-4" />
                    {showDm ? "Cancel" : "Message"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await unfriend(profile.userId)
                        toast("Unfriended.")
                        router.back()
                      } catch {
                        toast.error("Could not unfriend.")
                      }
                    }}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/60"
                  >
                    Unfriend
                  </button>
                </div>
              </div>
            )}
            {isOutgoing && (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/60">
                <UserPlus className="h-4 w-4" />
                Request sent
              </div>
            )}
            {isIncoming && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await acceptFriend(friendConnection!.id)
                      toast.success("Friend accepted!")
                    } catch {
                      toast.error("Could not accept request.")
                    }
                  }}
                  className="flex-1 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground"
                >
                  Accept request
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await declineFriend(friendConnection!.id)
                      toast("Request declined.")
                      router.back()
                    } catch {
                      toast.error("Could not decline request.")
                    }
                  }}
                  className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/60"
                >
                  Decline
                </button>
              </div>
            )}
            {!friendConnection && (
              <div className="space-y-2">
                {showFriendMsg && (
                  <input
                    value={friendMessage}
                    onChange={(e) => setFriendMessage(e.target.value)}
                    placeholder="Add a message (optional)"
                    className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-white/34"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFriendMsg(!showFriendMsg)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white"
                  >
                    {showFriendMsg ? "Cancel" : "Add message"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await addFriend(profile.userId, friendMessage)
                        toast.success("Friend request sent!")
                        setShowFriendMsg(false)
                        setFriendMessage("")
                      } catch {
                        toast.error("Could not send request.")
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground"
                  >
                    <UserPlus className="h-4 w-4" />
                    Connect
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="px-5 py-5 space-y-5">
        <section className="glass-card rounded-[2rem] p-5">
          <h2 className="font-heading text-lg font-bold text-white mb-4">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => {
              const meta = getCategoryMeta(interest)
              const isShared = sharedInterests.includes(interest)
              return (
                <div
                  key={interest}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 ${
                    isShared ? "bg-secondary/20" : "bg-white/8"
                  }`}
                >
                  <CategoryIcon category={interest} className="h-4 w-4" />
                  <span className={`text-xs font-bold ${isShared ? "text-secondary" : "text-white/62"}`}>
                    {meta.shortLabel}
                  </span>
                  {isShared && (
                    <img src="/icons/categories/same-wavelength.png" alt="same wavelength" className="h-3.5 w-3.5 object-contain" style={{ mixBlendMode: "screen" }} />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {earnedBadges.length > 0 && (
          <section className="glass-card rounded-[2rem] p-5">
            <div className="flex items-center gap-3 mb-4">
              <Award className="h-5 w-5 text-secondary" />
              <h2 className="font-heading text-lg font-bold text-white">Achievements</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {earnedBadges.map((badge) => (
                <div key={badge.id} className="rounded-3xl bg-white/8 p-4">
                  <p className="text-2xl">{badge.emoji}</p>
                  <p className="mt-2 text-sm font-bold text-white">{badge.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {theirActivities.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <CalendarHeart className="h-5 w-5 text-secondary" />
              <h2 className="font-heading text-lg font-bold text-white">Attending</h2>
            </div>
            <div className="space-y-3">
              {theirActivities.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/app/activity/${activity.id}`}
                  className="glass-card flex items-center justify-between rounded-3xl p-4 block"
                >
                  <div>
                    <p className="text-sm font-bold text-white">{activity.title}</p>
                    <p className="mt-1 text-xs text-white/42">{activity.location.name}</p>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-white/32 rotate-180" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
