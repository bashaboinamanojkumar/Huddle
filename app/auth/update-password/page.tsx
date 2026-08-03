"use client"

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound } from "lucide-react"
import { mapAuthError, validateNewPassword } from "@/lib/auth/credentials"
import {
  getAuthMessage,
  normalizeReturnPath,
  MIN_PASSWORD_LENGTH,
  type AuthErrorCode,
} from "@/lib/auth/policy"
import { isEligibleAuthUser } from "@/lib/auth/session-sync"
import { createClient } from "@/lib/supabase/client"

const FIELD_CLASS =
  "mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 text-sm text-white outline-none placeholder:text-white/34"
const LABEL_CLASS =
  "mt-4 block text-xs font-semibold uppercase tracking-wide text-white/46"

function UpdatePasswordPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checked, setChecked] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null)
  const verified = useRef(false)

  const next = normalizeReturnPath(searchParams.get("next"))
  const message = getAuthMessage(errorCode)

  // The recovery link established a session before redirecting here. Without one there is
  // nothing to update, and letting the form render would only fail at submit time.
  useEffect(() => {
    if (verified.current) {
      return
    }
    verified.current = true
    let active = true

    const confirmRecoverySession = async () => {
      const supabase = createClient()
      const reject = (code: AuthErrorCode) => {
        if (active) {
          router.replace(`/verify?error=${code}&next=${encodeURIComponent(next)}`)
        }
      }

      try {
        const { data, error } = await supabase.auth.getUser()
        if (!active) {
          return
        }
        if (error || !data.user) {
          reject("recovery_link_invalid")
          return
        }
        if (!isEligibleAuthUser(data.user)) {
          await supabase.auth.signOut()
          reject("campus_account_required")
          return
        }
        setChecked(true)
      } catch {
        reject("recovery_link_invalid")
      }
    }

    void confirmRecoverySession()
    return () => {
      active = false
    }
  }, [next, router])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) {
      return
    }

    const chosen = validateNewPassword(password, confirmation)
    if (!chosen.ok) {
      setErrorCode(chosen.errorCode)
      return
    }

    setErrorCode(null)
    setPending(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: chosen.value })
      if (error) {
        setErrorCode(mapAuthError(error, "password_update_failed"))
        setPending(false)
        return
      }
      router.replace(`/auth/continue?next=${encodeURIComponent(next)}`)
    } catch {
      setErrorCode("password_update_failed")
      setPending(false)
    }
  }

  if (!checked) {
    return (
      <div className="glass-card w-full max-w-md rounded-[2.25rem] p-6 text-sm text-white/58">
        Checking your reset link…
      </div>
    )
  }

  return (
    <div className="glass-card w-full max-w-md rounded-[2.25rem] p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/18">
        <KeyRound className="h-7 w-7 text-secondary" />
      </div>
      <h1 className="mt-6 font-heading text-3xl font-black tracking-tight text-white">
        Choose a new password.
      </h1>
      <p className="mt-2 text-sm leading-6 text-white/62">
        It needs at least {MIN_PASSWORD_LENGTH} characters. You stay signed in on this device
        once it is saved.
      </p>

      {message && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-white"
        >
          {message.text}
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <label className={LABEL_CLASS} htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          className={FIELD_CLASS}
        />

        <label className={LABEL_CLASS} htmlFor="new-password-confirmation">
          Confirm new password
        </label>
        <input
          id="new-password-confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Re-enter your new password"
          className={FIELD_CLASS}
        />

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="mt-6 w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-bold text-secondary-foreground transition-opacity disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-6 text-foreground">
      <Suspense fallback={null}>
        <UpdatePasswordPanel />
      </Suspense>
    </main>
  )
}
