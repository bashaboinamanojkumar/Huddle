"use client"

import { Suspense, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import {
  normalizeCampusEmail,
  normalizeReturnPath,
  isGoogleOnlyAccount,
  type AuthErrorCode,
} from "@/lib/auth/policy"
import { useHuddle } from "@/lib/store/huddle-store"
import { createClient } from "@/lib/supabase/client"

function metadataString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function ContinueSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hydrated, bridgeAuthenticatedUser, clearLocalSession } = useHuddle()
  const completed = useRef(false)

  useEffect(() => {
    if (!hydrated || completed.current) {
      return
    }
    let active = true

    const next = normalizeReturnPath(searchParams.get("next"))
    const reject = (error: AuthErrorCode) => {
      if (!active) return
      clearLocalSession()
      const query = new URLSearchParams({ error, next })
      router.replace(`/verify?${query.toString()}`)
    }

    const continueLogin = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (!active) {
          return
        }

        if (error || !user) {
          reject("session_expired")
          return
        }

        if (!user.email || !user.email_confirmed_at) {
          await supabase.auth.signOut()
          reject("missing_email")
          return
        }

        const email = normalizeCampusEmail(user.email)
        if (!email || !isGoogleOnlyAccount(user)) {
          await supabase.auth.signOut()
          reject("campus_account_required")
          return
        }

        const destination = bridgeAuthenticatedUser(
          {
            id: user.id,
            email,
            fullName:
              metadataString(user.user_metadata.full_name) ??
              metadataString(user.user_metadata.name),
            avatarUrl:
              metadataString(user.user_metadata.avatar_url) ??
              metadataString(user.user_metadata.picture),
          },
          next
        )

        completed.current = true
        router.replace(destination)
      } catch {
        reject("session_expired")
      }
    }

    void continueLogin()
    return () => {
      active = false
    }
  }, [
    bridgeAuthenticatedUser,
    clearLocalSession,
    hydrated,
    router,
    searchParams,
  ])

  return (
    <div className="glass-card w-full max-w-sm rounded-[2.25rem] p-7 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/18">
        <ShieldCheck className="h-7 w-7 text-secondary" />
      </div>
      <h1 className="mt-5 font-heading text-xl font-black text-white">
        Finishing secure sign-in
      </h1>
      <p className="mt-2 text-sm text-white/54">Connecting your verified campus profile…</p>
    </div>
  )
}

export default function AuthContinuePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <Suspense fallback={null}>
        <ContinueSession />
      </Suspense>
    </main>
  )
}
