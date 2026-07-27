"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ShieldCheck, WifiOff } from "lucide-react"
import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js"
import { normalizeReturnPath } from "@/lib/auth/policy"
import { decideSessionSync, type AuthUserLookup } from "@/lib/auth/session-sync"
import { useHuddle } from "@/lib/store/huddle-store"
import { createClient } from "@/lib/supabase/client"

type GuardStatus = "checking" | "confirmed" | "unavailable"

function metadataString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

/**
 * Only an answer from the auth service means "signed out". Transport failures must stay
 * distinguishable so the guard does not sign out a browser that still holds a valid cookie.
 */
async function lookupUser(supabase: SupabaseClient): Promise<AuthUserLookup> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (data.user) {
      return { status: "authenticated", user: data.user }
    }
    return isAuthRetryableFetchError(error)
      ? { status: "unavailable" }
      : { status: "unauthenticated" }
  } catch {
    return { status: "unavailable" }
  }
}

function GuardNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="glass-card w-full max-w-sm rounded-[2.25rem] p-7 text-center">
        {children}
      </div>
    </div>
  )
}

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { hydrated, state, bridgeAuthenticatedUser, clearLocalSession } = useHuddle()
  const [status, setStatus] = useState<GuardStatus>("checking")
  const [attempt, setAttempt] = useState(0)
  const settled = useRef(false)

  const retry = useCallback(() => {
    settled.current = false
    setStatus("checking")
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!hydrated || settled.current) {
      return
    }
    let active = true

    const synchronize = async () => {
      const supabase = createClient()
      const lookup = await lookupUser(supabase)

      if (!active) {
        return
      }

      const decision = decideSessionSync({
        lookup,
        localSession: state.session,
        now: new Date(),
      })

      if (decision.kind === "ready") {
        settled.current = true
        setStatus("confirmed")
        return
      }

      if (decision.kind === "unavailable") {
        settled.current = true
        setStatus("unavailable")
        return
      }

      if (decision.kind === "adopt" && lookup.status === "authenticated") {
        const user = lookup.user as {
          id: string
          email: string
          user_metadata: Record<string, unknown>
        }
        settled.current = true
        const destination = await bridgeAuthenticatedUser(
          {
            id: user.id,
            email: user.email,
            fullName:
              metadataString(user.user_metadata.full_name) ??
              metadataString(user.user_metadata.name),
            avatarUrl:
              metadataString(user.user_metadata.avatar_url) ??
              metadataString(user.user_metadata.picture),
          },
          pathname
        )

        if (destination === normalizeReturnPath(pathname)) {
          setStatus("confirmed")
        } else {
          router.replace(destination)
        }
        return
      }

      settled.current = true
      clearLocalSession()
      try {
        await supabase.auth.signOut()
      } catch {
        // Route protection still applies if local cookie cleanup cannot complete.
      }

      const query = new URLSearchParams({
        error: decision.kind === "reject" ? decision.errorCode : "session_expired",
        next: normalizeReturnPath(pathname),
      })
      router.replace(`/verify?${query.toString()}`)
    }

    // Adopting a session now reads from Supabase, so a transport failure here must land on
    // the retry notice rather than leaving the guard spinning forever.
    void synchronize().catch(() => {
      if (active) {
        settled.current = true
        setStatus("unavailable")
      }
    })

    return () => {
      active = false
    }
  }, [
    attempt,
    bridgeAuthenticatedUser,
    clearLocalSession,
    hydrated,
    pathname,
    router,
    state.session,
  ])

  if (status === "unavailable") {
    return (
      <GuardNotice>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <WifiOff className="h-7 w-7 text-white/70" />
        </div>
        <h1 className="mt-5 font-heading text-xl font-black text-white">
          Can&apos;t confirm your sign-in
        </h1>
        <p className="mt-2 text-sm text-white/54">
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-bold text-black"
        >
          Try again
        </button>
      </GuardNotice>
    )
  }

  if (status === "checking") {
    return (
      <GuardNotice>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/18">
          <ShieldCheck className="h-7 w-7 text-secondary" />
        </div>
        <p className="mt-5 text-sm text-white/54">
          Confirming your verified campus profile…
        </p>
      </GuardNotice>
    )
  }

  return children
}
