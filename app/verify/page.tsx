"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { createGoogleOAuthOptions } from "@/lib/auth/oauth"
import { getAuthMessage, type AuthErrorCode } from "@/lib/auth/policy"
import { createClient } from "@/lib/supabase/client"

function GoogleSignInPanel() {
  const searchParams = useSearchParams()
  const [isStarting, setIsStarting] = useState(false)
  const [startupErrorCode, setStartupErrorCode] = useState<AuthErrorCode | null>(null)
  const message = getAuthMessage(startupErrorCode ?? searchParams.get("error"))

  const signInWithGoogle = async () => {
    setIsStarting(true)
    setStartupErrorCode(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth(
        createGoogleOAuthOptions(window.location.origin, searchParams.get("next"))
      )

      if (error) {
        setStartupErrorCode("oauth_start_failed")
        setIsStarting(false)
      }
    } catch {
      setStartupErrorCode("oauth_start_failed")
      setIsStarting(false)
    }
  }

  return (
    <div className="glass-card rounded-[2.25rem] p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/18">
        <ShieldCheck className="h-7 w-7 text-secondary" />
      </div>
      <h1 className="mt-6 font-heading text-3xl font-black tracking-tight text-white">
        Verify your campus.
      </h1>
      <p className="mt-2 text-sm leading-6 text-white/62">
        Sign in with your UMD or University of Maryland Google account. Only verified
        <span className="font-semibold text-white"> @umd.edu</span> and
        <span className="font-semibold text-white"> @umaryland.edu</span> accounts are eligible.
      </p>

      {message && (
        <div
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error"
              ? "mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-white"
              : "mt-5 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white/78"
          }
        >
          {message.text}
        </div>
      )}

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isStarting}
        aria-busy={isStarting}
        className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition-opacity disabled:cursor-wait disabled:opacity-60"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-base font-black text-[#4285f4] shadow-sm">
          G
        </span>
        {isStarting ? "Opening Google…" : "Continue with Google"}
      </button>

      <p className="mt-4 text-center text-xs leading-5 text-white/42">
        Google is used only to verify your campus identity and basic profile.
      </p>
    </div>
  )
}

function LoadingPanel() {
  return (
    <div className="glass-card rounded-[2.25rem] p-6 text-sm text-white/58">
      Loading secure sign-in…
    </div>
  )
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-6 text-foreground">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm text-white/58">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <Suspense fallback={<LoadingPanel />}>
          <GoogleSignInPanel />
        </Suspense>
      </div>
    </main>
  )
}
