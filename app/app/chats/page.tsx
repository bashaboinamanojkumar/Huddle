"use client"

import Link from "next/link"
import { MessageCircle, UsersRound } from "lucide-react"
import { formatActivityDate, formatActivityTime } from "@/lib/format"
import { useHuddle } from "@/lib/store/huddle-store"

export default function ChatsPage() {
  const { chatActivities, state } = useHuddle()

  return (
    <div className="min-h-full bg-background px-5 py-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Coordinate</p>
        <h1 className="mt-1 font-heading text-3xl font-black text-white">Group chats</h1>
        <p className="mt-2 text-sm leading-6 text-white/58">
          Chats open automatically once an activity has at least two confirmed RSVPs.
        </p>
      </header>

      <div className="mt-5 space-y-4">
        {chatActivities.map((activity) => {
          const lastMessage = [...state.messages]
            .filter((message) => message.activityId === activity.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

          return (
            <Link key={activity.id} href={`/app/chats/${activity.id}`} className="glass-card block rounded-[2rem] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/18">
                  <MessageCircle className="h-6 w-6 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-heading text-lg font-bold leading-tight text-white">{activity.title}</h2>
                    <span className="shrink-0 rounded-full bg-mint/16 px-2.5 py-1 text-[11px] font-bold text-mint">
                      Open
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/50">
                    {formatActivityDate(activity.startTime)} at {formatActivityTime(activity.startTime)}
                  </p>
                  <p className="mt-2 truncate text-sm text-white/58">
                    {lastMessage?.body ?? "Say hi and confirm public meet-point logistics."}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/44">
                    <UsersRound className="h-4 w-4" />
                    {activity.goingCount} going
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {chatActivities.length === 0 && (
        <div className="glass-card mt-8 rounded-[2rem] p-6 text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-secondary" />
          <h2 className="mt-4 font-heading text-lg font-bold text-white">No open chats yet</h2>
          <p className="mt-2 text-sm leading-6 text-white/56">
            RSVP to an activity. When a second student joins, the logistics chat opens automatically.
          </p>
          <Link href="/app" className="mt-5 inline-flex rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground">
            Find activities
          </Link>
        </div>
      )}
    </div>
  )
}
