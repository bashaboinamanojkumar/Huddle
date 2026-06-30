"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Flag, Lock, MapPin, Send, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { formatActivityDate, formatActivityTime } from "@/lib/format"
import { useHuddle } from "@/lib/store/huddle-store"

function isArchived(startTime: string) {
  const archiveAt = new Date(startTime)
  archiveAt.setHours(archiveAt.getHours() + 48)
  return Date.now() > archiveAt.getTime()
}

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { activities, state, currentUserId, sendMessage, reportSafetyConcern, leaveActivity } = useHuddle()
  const [body, setBody] = useState("")
  const activity = activities.find((item) => item.id === params.id)

  const messages = useMemo(
    () =>
      state.messages
        .filter((message) => message.activityId === params.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [params.id, state.messages]
  )

  if (!activity) {
    return (
      <div className="flex min-h-full items-center justify-center px-5 text-center">
        <div className="glass-card rounded-[2rem] p-6">
          <h1 className="font-heading text-xl font-bold text-white">Chat not found</h1>
          <Link href="/app/chats" className="mt-4 inline-flex rounded-2xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground">
            Back to chats
          </Link>
        </div>
      </div>
    )
  }

  const archived = isArchived(activity.startTime)
  const userRsvped = activity.userRsvp?.status === "going"
  const chatOpen = activity.goingCount >= 2 && userRsvped

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || archived || !chatOpen) return

    const message = sendMessage(activity.id, trimmed)
    setBody("")
    if (message.flagged) {
      toast("Message sent and queued for human safety review.")
    }
  }

  const report = () => {
    reportSafetyConcern(`Safety concern reported in chat: ${activity.title}`)
    toast.success("Report sent to the review queue.")
  }

  const leave = () => {
    leaveActivity(activity.id)
    toast("You left the activity.")
    router.push("/app")
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="safe-pt border-b border-white/10 bg-black/35 px-5 pb-4 backdrop-blur-xl">
        <button type="button" onClick={() => router.back()} className="mb-4 flex items-center gap-2 text-sm text-white/64">
          <ArrowLeft className="h-4 w-4" />
          Chats
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-black leading-tight text-white">{activity.title}</h1>
            <p className="mt-1 text-xs text-white/50">
              {formatActivityDate(activity.startTime)} at {formatActivityTime(activity.startTime)}
            </p>
          </div>
          <button type="button" onClick={report} className="flex h-11 w-11 items-center justify-center rounded-full bg-coral/14 text-coral" aria-label="Report chat">
            <Flag className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="border-b border-white/10 bg-secondary/10 px-5 py-3">
        <div className="flex gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
          <div>
            <p className="text-sm font-bold text-white">Pinned meet-point: {activity.location.name}</p>
            <p className="mt-1 text-xs leading-5 text-white/54">{activity.location.safetyNote}</p>
          </div>
        </div>
      </div>

      {!chatOpen && (
        <div className="mx-5 mt-4 rounded-3xl border border-white/10 bg-white/8 p-4 text-sm text-white/58">
          Chat opens at two confirmed RSVPs.
        </div>
      )}

      {archived && (
        <div className="mx-5 mt-4 flex items-start gap-3 rounded-3xl border border-white/10 bg-white/8 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-white/50" />
          <p className="text-sm leading-6 text-white/58">This chat is archived 48 hours after the event and is now read-only.</p>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((message) => {
          const author = state.profiles.find((profile) => profile.userId === message.userId)
          const isMine = message.userId === currentUserId
          const isSystem = message.userId === "system"

          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-3xl px-4 py-3 ${
                  isSystem
                    ? "bg-secondary/12 text-secondary"
                    : isMine
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-white/10 text-white"
                }`}
              >
                {!isMine && !isSystem && (
                  <p className="mb-1 text-[11px] font-bold text-white/46">{author?.displayName ?? "Student"}</p>
                )}
                {isSystem && (
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-bold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Huddle
                  </div>
                )}
                <p className="text-sm leading-5">{message.body}</p>
                {message.flagged && <p className="mt-2 text-[11px] opacity-70">Queued for review</p>}
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={submit} className="safe-pb border-t border-white/10 bg-black/70 px-4 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={archived || !chatOpen}
            placeholder={archived ? "Archived chat" : "Message the group"}
            className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-white/8 px-4 text-sm text-white outline-none placeholder:text-white/34 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!body.trim() || archived || !chatOpen}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <button type="button" onClick={leave} className="mt-2 w-full rounded-2xl bg-white/6 px-4 py-3 text-xs font-bold text-white/56">
          Leave activity
        </button>
      </form>
    </div>
  )
}
