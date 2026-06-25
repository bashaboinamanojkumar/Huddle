"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Award, RotateCcw, ShieldCheck, Siren, UserRound } from "lucide-react"
import { toast } from "sonner"
import { crisisResources } from "@/lib/config/crisis"
import { getCategoryMeta } from "@/lib/format"
import { useHuddle } from "@/lib/store/huddle-store"

export default function ProfilePage() {
  const router = useRouter()
  const { currentProfile, state, reportSafetyConcern, resetDemo, signOut } = useHuddle()
  const email = state.session?.email ?? "student@umd.edu"

  const report = () => {
    reportSafetyConcern("General safety concern from profile screen")
    toast.success("Safety concern sent to the review queue.")
  }

  return (
    <div className="min-h-full bg-background px-5 py-5">
      <header className="glass-card rounded-[2rem] p-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-black text-white"
            style={{ backgroundColor: currentProfile.photoColor }}
          >
            {currentProfile.displayName.charAt(0)}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Profile</p>
            <h1 className="mt-1 font-heading text-2xl font-black text-white">{currentProfile.displayName}</h1>
            <p className="mt-1 text-sm text-white/50">{email}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-3xl bg-white/8 p-3 text-center">
            <p className="font-heading text-2xl font-black text-white">{currentProfile.streakDays}</p>
            <p className="text-[11px] text-white/46">day streak</p>
          </div>
          <div className="rounded-3xl bg-white/8 p-3 text-center">
            <p className="font-heading text-2xl font-black text-white">{currentProfile.points}</p>
            <p className="text-[11px] text-white/46">points</p>
          </div>
          <div className="rounded-3xl bg-white/8 p-3 text-center">
            <p className="font-heading text-2xl font-black text-white">{currentProfile.meetupsThisWeek}</p>
            <p className="text-[11px] text-white/46">meetups</p>
          </div>
        </div>
      </header>

      <section className="mt-5 glass-card rounded-[2rem] p-5">
        <div className="flex items-center gap-3">
          <UserRound className="h-5 w-5 text-secondary" />
          <h2 className="font-heading text-lg font-bold text-white">Fit preferences</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {currentProfile.interests.map((interest) => {
            const meta = getCategoryMeta(interest)
            return (
              <span key={interest} className="rounded-full bg-secondary/14 px-3 py-2 text-xs font-bold text-secondary">
                {meta.shortLabel}
              </span>
            )
          })}
        </div>
        <div className="mt-4 grid gap-3 text-sm text-white/62">
          <p>Group size: <span className="font-bold text-white">{currentProfile.comfortSize}</span></p>
          <p>Safety preference: <span className="font-bold text-white">{currentProfile.safetyPreference}</span></p>
          <p>Availability blocks: <span className="font-bold text-white">{currentProfile.availabilityBlocks.length}</span></p>
        </div>
        <Link href="/onboarding" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black">
          Edit setup
        </Link>
      </section>

      <section className="mt-5 glass-card rounded-[2rem] p-5">
        <div className="flex items-center gap-3">
          <Award className="h-5 w-5 text-secondary" />
          <h2 className="font-heading text-lg font-bold text-white">Badges</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {["First RSVP", "Public Meet-Point", "3 Day Streak", "Study Buddy"].map((badge) => (
            <div key={badge} className="rounded-3xl bg-white/8 p-4">
              <p className="text-sm font-bold text-white">{badge}</p>
              <p className="mt-1 text-xs text-white/42">Pilot badge</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] border border-coral/25 bg-coral/12 p-5">
        <div className="flex items-center gap-3">
          <Siren className="h-5 w-5 text-coral" />
          <h2 className="font-heading text-lg font-bold text-white">I do not feel safe</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-white/62">
          For immediate danger, call 911. For campus support, UMPD and UMD Counseling are one tap away.
        </p>
        <div className="mt-4 grid gap-3">
          {crisisResources.slice(0, 5).map((resource) => (
            <a
              key={resource.name}
              href={resource.href}
              className="flex items-center justify-between rounded-2xl bg-black/18 px-4 py-3 text-sm font-bold text-white"
            >
              <span>{resource.name}</span>
              <span className="text-xs text-secondary">{resource.action}</span>
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={report}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-4 py-3 text-sm font-black text-white"
        >
          <AlertTriangle className="h-4 w-4" />
          Report a concern
        </button>
      </section>

      <section className="mt-5 glass-card rounded-[2rem] p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-mint" />
          <h2 className="font-heading text-lg font-bold text-white">Pilot controls</h2>
        </div>
        <div className="mt-4 grid gap-3">
          <Link href="/app/admin/review" className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-bold text-white">
            Safety review queue
          </Link>
          <button
            type="button"
            onClick={() => {
              resetDemo()
              toast("Demo data reset.")
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/8 px-4 py-3 text-sm font-bold text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Reset demo data
          </button>
          <button
            type="button"
            onClick={() => {
              signOut()
              router.push("/")
            }}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black"
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  )
}
