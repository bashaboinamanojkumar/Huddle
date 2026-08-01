"use client"

import { Suspense, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, MailCheck, ShieldCheck } from "lucide-react"
import {
  mapAuthError,
  validateCampusEmail,
  validateSignIn,
  validateSignUp,
} from "@/lib/auth/credentials"
import { createGoogleOAuthOptions } from "@/lib/auth/oauth"
import {
  getAuthMessage,
  normalizeReturnPath,
  MIN_PASSWORD_LENGTH,
  type AuthErrorCode,
} from "@/lib/auth/policy"
import { createClient } from "@/lib/supabase/client"

type PanelMode = "signin" | "signup" | "reset"

interface SentNotice {
  kind: "confirmation" | "recovery"
  email: string
}

const FIELD_CLASS =
  "mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 text-sm text-white outline-none placeholder:text-white/34"
const LABEL_CLASS =
  "mt-4 block text-xs font-semibold uppercase tracking-wide text-white/46"

const MODE_COPY: Record<PanelMode, { action: string; pending: string }> = {
  signin: { action: "Sign in", pending: "Signing in…" },
  signup: { action: "Create account", pending: "Creating account…" },
  reset: { action: "Send reset link", pending: "Sending…" },
}

function CampusSignInPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<PanelMode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  )
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pendingAction, setPendingAction] = useState<"google" | "email" | null>(null)
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [sent, setSent] = useState<SentNotice | null>(null)

  const next = normalizeReturnPath(searchParams.get("next"))
  // The code carried in the URL explains how the visitor arrived, so it stays visible only
  // until their own attempt produces a more relevant result.
  const message = getAuthMessage(errorCode ?? (submitted ? null : searchParams.get("error")))
  const isBusy = pendingAction !== null

  const startAttempt = (action: "google" | "email") => {
    setSubmitted(true)
    setErrorCode(null)
    setPendingAction(action)
  }

  const failWith = (code: AuthErrorCode) => {
    setErrorCode(code)
    setPendingAction(null)
  }

  const switchMode = (nextMode: PanelMode) => {
    setMode(nextMode)
    setErrorCode(null)
    setSubmitted(true)
    setPassword("")
    setConfirmation("")
  }

  const signInWithGoogle = async () => {
    startAttempt("google")

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth(
        createGoogleOAuthOptions(window.location.origin, searchParams.get("next"))
      )

      if (error) {
        failWith("oauth_start_failed")
      }
    } catch {
      failWith("oauth_start_failed")
    }
  }

  const submitSignIn = async () => {
    const credentials = validateSignIn({ email, password })
    if (!credentials.ok) {
      failWith(credentials.errorCode)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword(credentials.value)
    if (error) {
      failWith(mapAuthError(error, "email_sign_in_failed"))
      return
    }

    // The pending state is deliberately held through the redirect so the form cannot be
    // submitted twice while the next route loads.
    router.replace(`/auth/continue?next=${encodeURIComponent(next)}`)
  }

  const submitSignUp = async () => {
    const credentials = validateSignUp({ email, password, confirmation })
    if (!credentials.ok) {
      failWith(credentials.errorCode)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      ...credentials.value,
      // Supabase appends this origin to the path held in the email template, which is what
      // lets one template serve both localhost and the deployed origin.
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      failWith(mapAuthError(error, "email_sign_up_failed"))
      return
    }

    // A session here means the project is not requiring email confirmation, so waiting for
    // a link that will never arrive would strand the student on this screen.
    if (data.session) {
      router.replace(`/auth/continue?next=${encodeURIComponent(next)}`)
      return
    }

    setSent({ kind: "confirmation", email: credentials.value.email })
    setPendingAction(null)
  }

  const submitReset = async () => {
    const address = validateCampusEmail(email)
    if (!address.ok) {
      failWith(address.errorCode)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(address.value, {
      redirectTo: window.location.origin,
    })

    if (error) {
      failWith(mapAuthError(error, "password_reset_failed"))
      return
    }

    setSent({ kind: "recovery", email: address.value })
    setPendingAction(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isBusy) {
      return
    }
    startAttempt("email")

    const fallback: AuthErrorCode =
      mode === "signin"
        ? "email_sign_in_failed"
        : mode === "signup"
          ? "email_sign_up_failed"
          : "password_reset_failed"

    try {
      if (mode === "signin") {
        await submitSignIn()
      } else if (mode === "signup") {
        await submitSignUp()
      } else {
        await submitReset()
      }
    } catch {
      failWith(fallback)
    }
  }

  if (sent) {
    return (
      <div className="glass-card rounded-[2.25rem] p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/18">
          <MailCheck className="h-7 w-7 text-secondary" />
        </div>
        <h1 className="mt-6 font-heading text-3xl font-black tracking-tight text-white">
          Check your inbox.
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/62">
          {sent.kind === "confirmation"
            ? "If that address does not already have an account, a confirmation link is on its way to "
            : "If that address has an account, a password reset link is on its way to "}
          <span className="font-semibold text-white">{sent.email}</span>. The link works once, and
          only for a limited time.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(null)
            switchMode("signin")
          }}
          className="mt-7 w-full rounded-2xl border border-white/12 bg-white/6 px-5 py-4 text-sm font-bold text-white"
        >
          Back to sign in
        </button>
      </div>
    )
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
        Only verified
        <span className="font-semibold text-white"> @umd.edu</span> and
        <span className="font-semibold text-white"> @umaryland.edu</span> accounts are
        eligible.
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
        disabled={isBusy}
        aria-busy={pendingAction === "google"}
        className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition-opacity disabled:cursor-wait disabled:opacity-60"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-base font-black text-[#4285f4] shadow-sm">
          G
        </span>
        {pendingAction === "google" ? "Opening Google…" : "Continue with Google"}
      </button>

      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/12" />
        <span className="text-xs font-semibold uppercase tracking-wide text-white/40">or</span>
        <span className="h-px flex-1 bg-white/12" />
      </div>

      <form onSubmit={submit} noValidate>
        <label className={LABEL_CLASS} htmlFor="campus-email">
          Campus email
        </label>
        <input
          id="campus-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@umd.edu"
          className={FIELD_CLASS}
        />

        {mode !== "reset" && (
          <>
            <label className={LABEL_CLASS} htmlFor="campus-password">
              Password
            </label>
            <input
              id="campus-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                mode === "signup" ? `At least ${MIN_PASSWORD_LENGTH} characters` : "Your password"
              }
              className={FIELD_CLASS}
            />
          </>
        )}

        {mode === "signup" && (
          <>
            <label className={LABEL_CLASS} htmlFor="campus-password-confirmation">
              Confirm password
            </label>
            <input
              id="campus-password-confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Re-enter your password"
              className={FIELD_CLASS}
            />
          </>
        )}

        <button
          type="submit"
          disabled={isBusy}
          aria-busy={pendingAction === "email"}
          className="mt-6 w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-bold text-secondary-foreground transition-opacity disabled:cursor-wait disabled:opacity-60"
        >
          {pendingAction === "email" ? MODE_COPY[mode].pending : MODE_COPY[mode].action}
        </button>
      </form>

      <div className="mt-5 space-y-2 text-center text-sm">
        {mode === "signin" ? (
          <>
            <p className="text-white/58">
              New here?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-semibold text-secondary"
              >
                Create an account
              </button>
            </p>
            <p>
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-white/50 underline-offset-4 hover:underline"
              >
                Forgot your password?
              </button>
            </p>
          </>
        ) : (
          <p className="text-white/58">
            {mode === "signup" ? "Already have an account?" : "Remembered it?"}{" "}
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="font-semibold text-secondary"
            >
              Sign in
            </button>
          </p>
        )}
      </div>

      <p className="mt-5 text-center text-xs leading-5 text-white/42">
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
          <CampusSignInPanel />
        </Suspense>
      </div>
    </main>
  )
}
