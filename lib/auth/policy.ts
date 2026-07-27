export const CAMPUS_DOMAINS = ["umd.edu", "umaryland.edu"] as const

export type CampusDomain = (typeof CAMPUS_DOMAINS)[number]

export type AuthErrorCode =
  | "oauth_start_failed"
  | "oauth_cancelled"
  | "invalid_callback"
  | "missing_email"
  | "campus_account_required"
  | "session_expired"
  | "sign_in_required"

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  oauth_start_failed: "Google sign-in could not be started. Please try again.",
  oauth_cancelled: "Google sign-in was cancelled or denied.",
  invalid_callback: "That sign-in link is invalid or expired. Please try again.",
  missing_email: "Google did not provide a verified email address.",
  campus_account_required: "Use an eligible UMD or University of Maryland Google account.",
  session_expired: "Your session expired. Sign in again to continue.",
  sign_in_required: "Sign in with your campus Google account to continue.",
}

/**
 * `sign_in_required` reports an expected precondition rather than a fault, so it must not
 * render in the alarming style used for a failed or rejected sign-in.
 */
export type AuthMessageTone = "notice" | "error"

const AUTH_MESSAGE_TONES: Record<AuthErrorCode, AuthMessageTone> = {
  oauth_start_failed: "error",
  oauth_cancelled: "error",
  invalid_callback: "error",
  missing_email: "error",
  campus_account_required: "error",
  session_expired: "error",
  sign_in_required: "notice",
}

export interface AuthMessage {
  text: string
  tone: AuthMessageTone
}

const AUTH_ENTRY_PATHS = new Set([
  "/verify",
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/continue",
])

export function normalizeCampusEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  const match = /^([^\s@]+)@([^\s@]+)$/.exec(normalized)

  if (!match || !CAMPUS_DOMAINS.includes(match[2] as CampusDomain)) {
    return null
  }

  return normalized
}

export function isEligibleCampusEmail(value: string): boolean {
  return normalizeCampusEmail(value) !== null
}

export const GOOGLE_PROVIDER = "google"

interface ProviderAwareUser {
  app_metadata?: unknown
  identities?: unknown
  is_anonymous?: unknown
}

function isGoogleProvider(value: unknown): boolean {
  return value === GOOGLE_PROVIDER
}

/**
 * Establishes that Google is the only way this account can authenticate, so an account
 * that also carries a password or OTP path is rejected rather than treated as a Google
 * sign-in.
 *
 * This deliberately avoids `identities[].last_sign_in_at`: GoTrue writes that field when
 * an identity is created and never refreshes it, so comparing it against the user's
 * `last_sign_in_at` rejects every returning user. `app_metadata.provider`,
 * `app_metadata.providers`, and the identity list are the fields GoTrue keeps current.
 */
export function isGoogleOnlyAccount(user: unknown): boolean {
  if (!user || typeof user !== "object") {
    return false
  }

  const candidate = user as ProviderAwareUser
  if (candidate.is_anonymous === true) {
    return false
  }

  const appMetadata =
    candidate.app_metadata && typeof candidate.app_metadata === "object"
      ? (candidate.app_metadata as { provider?: unknown; providers?: unknown })
      : null

  if (!appMetadata || !isGoogleProvider(appMetadata.provider)) {
    return false
  }

  // `providers` lists every linked login method for the account.
  if (
    !Array.isArray(appMetadata.providers) ||
    appMetadata.providers.length === 0 ||
    !appMetadata.providers.every(isGoogleProvider)
  ) {
    return false
  }

  if (!Array.isArray(candidate.identities) || candidate.identities.length === 0) {
    return false
  }

  return candidate.identities.every((value) => {
    if (!value || typeof value !== "object") {
      return false
    }
    return isGoogleProvider((value as { provider?: unknown }).provider)
  })
}

function isSafeReturnPath(value: string): boolean {
  const hasControlCharacter = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
  const hasEncodedControlCharacter = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasControlCharacter ||
    hasEncodedControlCharacter
  ) {
    return false
  }

  const pathname = value.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/"
  return !AUTH_ENTRY_PATHS.has(pathname)
}

export function normalizeReturnPath(
  value: string | null | undefined,
  fallback = "/app"
): string {
  const normalizedFallback = isSafeReturnPath(fallback) ? fallback : "/app"

  if (!value) {
    return normalizedFallback
  }

  const candidate = value.trim()
  return isSafeReturnPath(candidate) ? candidate : normalizedFallback
}

export function isAuthErrorCode(value: string | null | undefined): value is AuthErrorCode {
  return Boolean(value && value in AUTH_ERROR_MESSAGES)
}

export function getAuthMessage(value: string | null | undefined): AuthMessage | null {
  return isAuthErrorCode(value)
    ? { text: AUTH_ERROR_MESSAGES[value], tone: AUTH_MESSAGE_TONES[value] }
    : null
}
