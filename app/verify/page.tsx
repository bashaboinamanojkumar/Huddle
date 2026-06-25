"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react"
import { isCampusEmail, useHuddle } from "@/lib/store/huddle-store"

export default function VerifyPage() {
  const router = useRouter()
  const { addToWaitlist, signInWithEmail, state } = useHuddle()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sent" | "waitlist">("idle")
  const [error, setError] = useState("")

  const normalizedEmail = email.trim().toLowerCase()
  const waitlistCount = useMemo(() => Math.max(state.waitlist.length, 3), [state.waitlist.length])

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid campus email.")
      return
    }

    if (!isCampusEmail(normalizedEmail)) {
      addToWaitlist(normalizedEmail)
      setStatus("waitlist")
      return
    }

    setStatus("sent")
  }

  const openMagicLink = () => {
    const session = signInWithEmail(normalizedEmail)
    const profile = state.profiles.find((item) => item.userId === session.userId)
    router.push(profile?.completedOnboarding ? "/app" : "/onboarding")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-6 text-foreground">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm text-white/58">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="glass-card rounded-[2.25rem] p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/18">
            <ShieldCheck className="h-7 w-7 text-secondary" />
          </div>
          <h1 className="mt-6 font-heading text-3xl font-black tracking-tight text-white">
            Verify your campus.
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/62">
            Phase 1 is limited to UMD and University of Maryland email domains. Passwordless sign-in keeps the pilot low-friction.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-3">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-white/46">
              Campus email
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-2">
              <Mail className="h-5 w-5 text-white/42" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setStatus("idle")
                  setError("")
                }}
                placeholder="your.name@umd.edu"
                className="min-h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/32"
                autoComplete="email"
                required
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-4 text-sm font-bold text-secondary-foreground"
            >
              Send magic link
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {status === "sent" && (
            <div className="mt-5 rounded-3xl border border-mint/20 bg-mint/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" />
                <div>
                  <p className="text-sm font-semibold text-white">Magic link ready</p>
                  <p className="mt-1 text-xs leading-5 text-white/58">
                    In production this arrives by email. For the UI-first demo, tap below to open the secure link.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openMagicLink}
                className="mt-4 flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black"
              >
                Open secure link
              </button>
            </div>
          )}

          {status === "waitlist" && (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-semibold text-white">Not yet at your campus</p>
              <p className="mt-1 text-xs leading-5 text-white/58">
                You are on the waitlist. We have captured interest from {waitlistCount} students outside the launch campus.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
