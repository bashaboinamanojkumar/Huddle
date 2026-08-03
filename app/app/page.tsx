"use client"

import { useMemo } from "react"
import Link from "next/link"
import { CalendarHeart, ChevronRight, Share2, UserPlus, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { ActivityCard } from "@/components/huddle/activity-card"
import { useHuddle } from "@/lib/store/huddle-store"
import { formatActivityDate, formatActivityTime } from "@/lib/format"

export default function FeedPage() {
  const { approvedActivities, currentProfile, currentUserId, state, addFriend, acceptFriend, declineFriend, refresh } = useHuddle()

  const attendingActivities = useMemo(
    () => approvedActivities.filter((a) => a.userRsvp?.status === "going"),
    [approvedActivities]
  )

  const leaderboard = useMemo(
    () => [...state.profiles]
      .filter((p) => p.userId !== currentUserId)
      .sort((a, b) => b.meetupsThisWeek - a.meetupsThisWeek || b.points - a.points),
    [state.profiles, currentUserId]
  )

  const myFriendIds = useMemo(
    () => new Set(
      state.friends
        .filter((f) => f.status === "accepted" && (f.userId === currentUserId || f.friendId === currentUserId))
        .map((f) => f.userId === currentUserId ? f.friendId : f.userId)
    ),
    [state.friends, currentUserId]
  )

  const myFriends = useMemo(
    () => state.friends
      .filter((f) => f.userId === currentUserId)
      .map((f) => ({ connection: f, profile: state.profiles.find((p) => p.userId === f.friendId) }))
      .filter((item) => item.profile),
    [state.friends, state.profiles, currentUserId]
  )

  const incomingRequests = useMemo(
    () => state.friends
      .filter((f) => f.friendId === currentUserId && f.status === "pending")
      .map((f) => ({ connection: f, profile: state.profiles.find((p) => p.userId === f.userId) }))
      .filter((item) => item.profile),
    [state.friends, state.profiles, currentUserId]
  )

  const outgoingRequests = useMemo(
    () => state.friends
      .filter((f) => f.userId === currentUserId && f.status === "pending")
      .map((f) => ({ connection: f, profile: state.profiles.find((p) => p.userId === f.friendId) }))
      .filter((item) => item.profile),
    [state.friends, state.profiles, currentUserId]
  )

  const acceptedFriends = useMemo(
    () => state.friends
      .filter((f) => f.status === "accepted" && (f.userId === currentUserId || f.friendId === currentUserId))
      .map((f) => {
        const otherUserId = f.userId === currentUserId ? f.friendId : f.userId
        return { connection: f, profile: state.profiles.find((p) => p.userId === otherUserId) }
      })
      .filter((item) => item.profile),
    [state.friends, state.profiles, currentUserId]
  )
  
  const pendingFriendIds = useMemo(
    () => new Set(state.friends.filter((f) => f.userId === currentUserId && f.status === "pending").map((f) => f.friendId)),
    [state.friends, currentUserId]
  )

  const suggestions = useMemo(
    () => state.profiles
      .filter((p) => p.userId !== currentUserId && !myFriendIds.has(p.userId) && !pendingFriendIds.has(p.userId))
      .slice(0, 3),
    [state.profiles, currentUserId, myFriendIds, pendingFriendIds]
  )

  const invite = () => toast("Invite link copied for the pilot demo.")

  const sendRequest = async (friendId: string) => {
    try {
      await addFriend(friendId)
      toast.success("Friend request sent.")
    } catch {
      toast.error("Could not send the request. Please try again.")
    }
  }

  return (
    <div className="min-h-full bg-background">
      <header className="hero-gradient safe-pt rounded-b-[2.5rem] px-5 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">Huddle</p>
            <h1 className="mt-2 font-heading text-3xl font-black leading-none text-white">
              Hey, {currentProfile.firstName} 👋
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={invite}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/16 text-white"
              aria-label="Invite friends"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <Link
              href="/app/profile"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 text-sm font-black text-white"
              style={{ backgroundColor: currentProfile.photoColor }}
              aria-label="Open profile"
            >
              {currentProfile.displayName.charAt(0)}
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-3xl bg-black/18 p-3">
            <p className="font-heading text-2xl font-black text-white">{attendingActivities.length}</p>
            <p className="text-[11px] text-white/62">attending</p>
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
      </header>

      <main className="px-5 py-5 space-y-5">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-xl font-black text-white">Your huddles</h2>
            <Link href="/app/community" className="text-xs font-bold text-secondary">
              Browse all
            </Link>
          </div>
          {attendingActivities.length === 0 ? (
            <div className="glass-card rounded-[2rem] p-6 text-center">
              <img src="/ollie.png" alt="Ollie the otter" className="mx-auto h-24 w-24 object-contain mix-blend-mode-screen" style={{ mixBlendMode: "screen" }} />
              <h3 className="mt-4 font-heading text-lg font-bold text-white">No huddles yet</h3>
              <p className="mt-2 text-sm leading-6 text-white/56">
                Browse events and huddle up to something that interests you.
              </p>
              <Link
                href="/app/community"
                className="mt-5 inline-flex rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground"
              >
                Find events
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {attendingActivities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-xl font-black text-white">Same wavelength</h2>
            <span className="text-xs text-white/46">{leaderboard.length} students</span>
          </div>
          <div className="glass-card rounded-[2rem] overflow-hidden">
            {leaderboard.filter((p) => !myFriendIds.has(p.userId)).slice(0, 5).map((profile, index) => {
              const isMe = false
              const isFriend = false
              return (
                <Link
                  key={profile.userId}
                  href={isMe ? "/app/profile" : `/app/profile/${profile.userId}`}
                  className={`flex items-center justify-between px-4 py-3 border-b border-white/8 last:border-b-0 ${isMe ? "bg-secondary/10" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-white/40">#{index + 1}</span>
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{ backgroundColor: profile.photoColor }}
                    >
                      {profile.displayName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {isMe ? "You" : profile.displayName}
                      </p>
                      <p className="text-xs text-white/42">{profile.points} pts · {profile.meetupsThisWeek} meetups</p>
                    </div>
                  </div>
                  {!isMe && !isFriend && (
                    <button
                      type="button"
                      onClick={() => void sendRequest(profile.userId)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/18 text-secondary"
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                  )}
                  {isFriend && (
                    <span className="text-xs font-bold text-mint">Friend</span>
                  )}
                </Link>
              )
            })}
          </div>
        </section>

      {incomingRequests.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
              <h2 className="font-heading text-xl font-black text-white">Friend requests</h2>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[10px] font-black text-white">
                {incomingRequests.length}
              </span>
          </div>
          <div className="glass-card rounded-[2rem] overflow-hidden">
              {incomingRequests.map(({ connection, profile }) => (
                <div key={connection.id} className="flex items-center justify-between border-b border-white/8 px-4 py-3 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{ backgroundColor: profile!.photoColor }}
                    >
                      {profile!.displayName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{profile!.displayName}</p>
                      <p className="text-xs text-white/42">wants to connect</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await acceptFriend(connection.id)
                            toast.success("Friend accepted!")
                          } catch {
                            toast.error("Could not accept request.")
                          }
                        }}
                        className="rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await declineFriend(connection.id)
                            toast("Request declined.")
                          } catch {
                            toast.error("Could not decline request.")
                          }
                        }}
                        className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/60"
                      >
                        Decline
                      </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
        )}

        {acceptedFriends.length > 0 && (
          <section>
            <h2 className="font-heading text-xl font-black text-white mb-3">Your circle</h2>
            <div className="space-y-3">
              {acceptedFriends.map(({ connection, profile }) => (
                <Link key={connection.id} href={`/app/profile/${profile!.userId}`} className="glass-card flex items-center justify-between rounded-3xl p-4 block">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{ backgroundColor: profile!.photoColor }}
                    >
                      {profile!.displayName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{profile!.displayName}</p>
                      <p className="text-xs text-white/42">{profile!.points} pts · {profile!.meetupsThisWeek} meetups</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/32" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {outgoingRequests.length > 0 && (
          <section>
            <h2 className="font-heading text-xl font-black text-white mb-3">Pending requests</h2>
            <div className="glass-card rounded-[2rem] overflow-hidden">
              {outgoingRequests.map(({ connection, profile }) => (
                <div key={connection.id} className="flex items-center justify-between border-b border-white/8 px-4 py-3 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{ backgroundColor: profile!.photoColor }}
                    >
                      {profile!.displayName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{profile!.displayName}</p>
                      <p className="text-xs text-white/42">Request sent</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white/40">Pending</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {suggestions.length > 0 && (
          <section>
            <h2 className="font-heading text-xl font-black text-white mb-3">You might know</h2>
            <div className="glass-card rounded-[2rem] overflow-hidden">
              {suggestions.map((profile) => (
                <div key={profile.userId} className="flex items-center justify-between border-b border-white/8 px-4 py-3 last:border-b-0">
                  <Link href={`/app/profile/${profile.userId}`} className="flex items-center gap-3 flex-1">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{ backgroundColor: profile.photoColor }}
                    >
                      {profile.displayName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{profile.displayName}</p>
                      <p className="text-xs text-white/42">{profile.meetupsThisWeek} meetups this week</p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void sendRequest(profile.userId)}
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {acceptedFriends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 && suggestions.length === 0 && (
          <section>
            <div className="glass-card rounded-[2rem] p-6 text-center">
              <img src="/ollie.png" alt="Ollie the otter" className="mx-auto h-24 w-24 object-contain mix-blend-mode-screen" style={{ mixBlendMode: "screen" }} />
              <h3 className="mt-4 font-heading text-lg font-bold text-white">Build your circle</h3>
              <p className="mt-2 text-sm leading-6 text-white/56">
                Huddle up to events and connect with students on the same wavelength.
              </p>
              <Link
                href="/app/community"
                className="mt-5 inline-flex rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground"
              >
                Browse events
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}