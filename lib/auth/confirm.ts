import {
  resolveEligibleUser,
  verifyDestination,
  type AuthCallbackResult,
  type CallbackAuth,
} from "@/lib/auth/callback"
import { normalizeReturnPath } from "@/lib/auth/policy"

/**
 * `email` is the type Supabase's own template ships with; GoTrue resolves it against the
 * confirmation token, so it is accepted alongside the explicit `signup`. Every other OTP
 * type — magic link, invite, email change — is not a flow this application offers.
 */
export type ConfirmableOtpType = "signup" | "email" | "recovery"

const CONFIRMABLE_OTP_TYPES: readonly string[] = ["signup", "email", "recovery"]

export const EMAIL_CONFIRMATION_COOKIE = "huddle-email-confirmation"

export interface ConfirmAuth extends CallbackAuth {
  verifyOtp: (params: {
    token_hash: string
    type: ConfirmableOtpType
  }) => Promise<{ error: unknown | null }>
}

export function isConfirmableOtpType(value: string | null): value is ConfirmableOtpType {
  return value !== null && CONFIRMABLE_OTP_TYPES.includes(value)
}

/**
 * Accepts either shape a Supabase email link can arrive in, because which one is sent is a
 * dashboard setting rather than something this repository controls. A `token_hash` comes
 * from the template documented in `docs/email-password-setup.md` and verifies from any
 * device; a `code` is the PKCE form, which only resolves in the browser that started the
 * flow.
 */
export async function processEmailConfirmation(
  url: URL,
  auth: ConfirmAuth
): Promise<AuthCallbackResult> {
  const next = normalizeReturnPath(url.searchParams.get("next"))
  const type = url.searchParams.get("type")

  // A PKCE link carries no type, so a recovery can also be marked on the redirect target
  // that asked for the email. Without either, the link is treated as a confirmation.
  const isRecovery = type === "recovery" || url.searchParams.get("flow") === "recovery"
  const linkErrorCode = isRecovery ? "recovery_link_invalid" : "confirmation_link_invalid"

  if (url.searchParams.get("error") || url.searchParams.get("error_code")) {
    return verifyDestination(linkErrorCode, next)
  }

  const tokenHash = url.searchParams.get("token_hash")
  const code = url.searchParams.get("code")

  try {
    if (tokenHash) {
      if (!isConfirmableOtpType(type)) {
        return verifyDestination(linkErrorCode, next)
      }
      const { error } = await auth.verifyOtp({ token_hash: tokenHash, type })
      if (error) {
        return verifyDestination(linkErrorCode, next)
      }
    } else if (code) {
      const { error } = await auth.exchangeCodeForSession(code)
      if (error) {
        return verifyDestination(linkErrorCode, next)
      }
    } else {
      return verifyDestination(linkErrorCode, next)
    }
  } catch {
    return verifyDestination(linkErrorCode, next)
  }

  const eligible = await resolveEligibleUser(auth, linkErrorCode)
  if (!eligible.ok) {
    return verifyDestination(eligible.errorCode, next)
  }

  const search = new URLSearchParams({ next })
  return {
    destination: isRecovery
      ? `/auth/update-password?${search.toString()}`
      : `/auth/continue?${search.toString()}`,
    errorCode: null,
  }
}
