import {
  MIN_PASSWORD_LENGTH,
  normalizeCampusEmail,
  type AuthErrorCode,
} from "@/lib/auth/policy"

export type CredentialCheck<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: AuthErrorCode }

export interface EmailPasswordCredentials {
  email: string
  password: string
}

function invalid<T>(errorCode: AuthErrorCode): CredentialCheck<T> {
  return { ok: false, errorCode }
}

export function validateCampusEmail(email: string): CredentialCheck<string> {
  const normalized = normalizeCampusEmail(email)
  return normalized ? { ok: true, value: normalized } : invalid("invalid_campus_email")
}

/**
 * Sign-in only checks that something was typed. Applying the sign-up password rules here
 * would tell an attacker which addresses have a password that predates the current policy,
 * and would lock out a real student instead of letting the API answer.
 */
export function validateSignIn(
  input: EmailPasswordCredentials
): CredentialCheck<EmailPasswordCredentials> {
  const email = validateCampusEmail(input.email)
  if (!email.ok) {
    return invalid(email.errorCode)
  }
  if (!input.password) {
    return invalid("invalid_credentials")
  }

  return { ok: true, value: { email: email.value, password: input.password } }
}

export function validateSignUp(
  input: EmailPasswordCredentials & { confirmation: string }
): CredentialCheck<EmailPasswordCredentials> {
  const email = validateCampusEmail(input.email)
  if (!email.ok) {
    return invalid(email.errorCode)
  }

  const password = validateNewPassword(input.password, input.confirmation)
  if (!password.ok) {
    return invalid(password.errorCode)
  }

  return { ok: true, value: { email: email.value, password: password.value } }
}

export function validateNewPassword(
  password: string,
  confirmation: string
): CredentialCheck<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return invalid("weak_password")
  }
  if (password !== confirmation) {
    return invalid("password_mismatch")
  }

  return { ok: true, value: password }
}

/**
 * Only codes whose message is both accurate and safe to show are mapped. Anything else —
 * including `user_already_exists`, which would confirm that an address is registered —
 * falls through to the caller's generic failure so the response stays uninformative.
 */
const AUTH_ERROR_BY_SUPABASE_CODE: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  weak_password: "weak_password",
  same_password: "password_unchanged",
  email_address_invalid: "invalid_campus_email",
  email_address_not_authorized: "invalid_campus_email",
  over_request_rate_limit: "too_many_requests",
  over_email_send_rate_limit: "too_many_requests",
  otp_expired: "recovery_link_invalid",
}

export function mapAuthError(error: unknown, fallback: AuthErrorCode): AuthErrorCode {
  if (!error || typeof error !== "object") {
    return fallback
  }

  const candidate = error as { code?: unknown; status?: unknown }
  if (typeof candidate.code === "string" && candidate.code in AUTH_ERROR_BY_SUPABASE_CODE) {
    return AUTH_ERROR_BY_SUPABASE_CODE[candidate.code]
  }
  if (candidate.status === 429) {
    return "too_many_requests"
  }

  return fallback
}
