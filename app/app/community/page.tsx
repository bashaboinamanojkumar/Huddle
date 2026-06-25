"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Search, Share2, Trophy, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { useHuddle } from "@/lib/store/huddle-store"

export default function CommunityPage() {
  const { state, currentUserId, currentProfile, addFriend } = useHuddle()
  const [query, setQuery] = useState("")

  const leaderboard = useMemo(
    () => [...state.profiles].sort((a, b) => b.meetupsThisWeek - a.meetupsThisWeek || b.points - a.points),
    [state.profiles]
  )
  const podium = [leaderboard[1], leaderboard[0], leaderboard[2]].filter(Boolean)
  const myFriends = state.friends
    .filter((friend) => friend.userId === currentUserId)
    .map((friend) => ({
      connection: friend,
      profile: state.profiles.find((profile) => profile.userId === friend.friendId),
    }))
    .filter((item) => item.profile)
  const suggestions = state.profiles.filter((profile) => {
    if (profile.userId === currentUserId) return false
    if (state.friends.some((friend) => friend.userId === currentUserId && friend.friendId === profile.userId)) return false
    if (!query.trim()) return true
    return profile.displayName.toLowerCase().includes(query.trim().toLowerCase())
  })

  const invite = () => {
    toast("Invite copied for the pilot demo.")
  }

  return (
    <div className="min-h-full bg-background">
      <header className="hero-gradient safe-pt rounded-b-[2.5rem] px-5 pb-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">Community</p>
            <h1 className="mt-2 font-heading text-3xl font-black text-white">Meetups this week</h1>
          </div>
          <button
            type="button"
            onClick={invite}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/16 text-white"
            aria-label="Invite friends"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 flex items-end justify-center gap-3">
          {podium.map((profile, index) => {
            const isWinner = index === 1
            const place = index === 1 ? "1" : index === 0 ? "2" : "3"
            return (
              <div key={profile.userId} className={`flex flex-col items-center ${isWinner ? "pb-0" : "pb-5"}`}>
                <div className="relative">
                  <div
                    className={`${isWinner ? "h-20 w-20" : "h-16 w-16"} flex items-center justify-center rounded-full border-4 border-white/24 text-lg font-black text-white shadow-xl`}
                    style={{ backgroundColor: profile.photoColor }}
                  >
                    {profile.displayName.charAt(0)}
                  </div>
                  <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-black text-secondary-foreground">
                    {place}
                  </span>
                </div>
                <p className="mt-2 max-w-20 truncate text-center text-xs font-bold text-white">{profile.displayName}</p>
                <p className="text-[11px] text-white/58">{profile.meetupsThisWeek} meetups</p>
              </div>
            )
          })}
        </div>
      </header>

      <main className="px-5 py-5">
        <section className="glass-card rounded-[2rem] p-5">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-secondary" />
            <div>
              <h2 className="font-heading text-lg font-bold text-white">Your progress</h2>
              <p className="text-xs text-white/50">Gentle gamification for showing up.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-3xl bg-white/8 p-3 text-center">
              <p className="font-heading text-2xl font-black text-white">{currentProfile.meetupsThisWeek}</p>
              <p className="text-[11px] text-white/46">meetups</p>
            </div>
            <div className="rounded-3xl bg-white/8 p-3 text-center">
              <p className="font-heading text-2xl font-black text-white">{currentProfile.streakDays}</p>
              <p className="text-[11px] text-white/46">streak</p>
            </div>
            <div className="rounded-3xl bg-white/8 p-3 text-center">
              <p className="font-heading text-2xl font-black text-white">{currentProfile.points}</p>
              <p className="text-[11px] text-white/46">points</p>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-xl font-black text-white">Friends</h2>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-black">Add</span>
          </div>
          <div className="glass-card overflow-hidden rounded-[2rem]">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Search className="h-5 w-5 text-white/36" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Add friends by searching their name"
                className="min-h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/32"
              />
            </div>

            {suggestions.slice(0, 2).map((profile) => (
              <div key={profile.userId} className="flex items-center justify-between border-b border-white/8 px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-3">
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
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addFriend(profile.userId)
                    toast.success("Friend request sent.")
                  }}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-3 font-heading text-xl font-black text-white">Your circle</h2>
          <div className="space-y-3">
            {myFriends.map(({ connection, profile }) => (
              <div key={connection.id} className="glass-card flex items-center justify-between rounded-3xl p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-black text-white"
                    style={{ backgroundColor: profile!.photoColor }}
                  >
                    {profile!.displayName.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{profile!.displayName}</p>
                    <p className="text-xs text-white/42">{connection.status === "accepted" ? "active friend" : "request pending"}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/32" />
              </div>
            ))}
          </div>
          {myFriends.length === 0 && (
            <div className="glass-card rounded-[2rem] p-5 text-center">
              <UsersRound className="mx-auto h-9 w-9 text-secondary" />
              <p className="mt-3 text-sm text-white/58">Add a friend to start building your launch cohort.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
