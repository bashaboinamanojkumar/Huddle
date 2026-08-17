/**
 * `terpmail.umd.edu` and `rx.maryland.edu` are named explicitly because matching is exact:
 * listing one campus subdomain must not admit any other subdomain automatically.
 */
export const CAMPUS_DOMAINS = [
  "umd.edu",
  "terpmail.umd.edu",
  "umaryland.edu",
  "rx.maryland.edu",
] as const

export type CampusDomain = (typeof CAMPUS_DOMAINS)[number]

/**
 * Copy that has to name every eligible domain is built from `CAMPUS_DOMAINS`, so adding one
 * cannot leave a screen or an error message advertising a stale set.
 */
export function formatCampusDomains(conjunction: "and" | "or"): string {
  const suffixes = CAMPUS_DOMAINS.map((domain) => `@${domain}`)

  if (suffixes.length < 3) {
    return suffixes.join(` ${conjunction} `)
  }

  const last = suffixes[suffixes.length - 1]
  return `${suffixes.slice(0, -1).join(", ")}, ${conjunction} ${last}`
}

/**
 * Supabase enforces its own minimum, so this has to be at least as strict as the value
 * configured on the project or the browser would accept a password the API then rejects.
 */
export const MIN_PASSWORD_LENGTH = 8

export type AuthErrorCode =
  | "oauth_start_failed"
  | "oauth_cancelled"
  | "invalid_callback"
  | "missing_email"
  | "campus_account_required"
  | "session_expired"
  | "sign_in_required"
  | "invalid_campus_email"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "weak_password"
  | "password_mismatch"
  | "password_unchanged"
  | "email_sign_in_failed"
  | "email_sign_up_failed"
  | "password_reset_failed"
  | "password_update_failed"
  | "too_many_requests"
  | "confirmation_link_invalid"
  | "recovery_link_invalid"

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  oauth_start_failed: "Google sign-in could not be started. Please try again.",
  oauth_cancelled: "Google sign-in was cancelled or denied.",
  invalid_callback: "That sign-in link is invalid or expired. Please try again.",
  missing_email: "That account has no verified email address.",
  campus_account_required: "Use an eligible UMD or University of Maryland campus account.",
  session_expired: "Your session expired. Sign in again to continue.",
  sign_in_required: "Sign in with your campus account to continue.",
  invalid_campus_email: `Enter your ${formatCampusDomains("or")} campus email address.`,
  invalid_credentials: "That email and password combination is incorrect.",
  email_not_confirmed: "Confirm your campus email from the link we sent, then sign in.",
  weak_password: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
  password_mismatch: "Those passwords do not match.",
  password_unchanged: "Choose a password that differs from your current one.",
  email_sign_in_failed: "Sign-in could not be completed. Please try again.",
  email_sign_up_failed: "Your account could not be created. Please try again.",
  password_reset_failed: "The reset email could not be sent. Please try again.",
  password_update_failed: "Your password could not be updated. Please try again.",
  too_many_requests: "Too many attempts. Wait a minute and try again.",
  confirmation_link_invalid:
    "That confirmation link is invalid or expired. Request a new one.",
  recovery_link_invalid: "That reset link is invalid or expired. Request a new one.",
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
  invalid_campus_email: "error",
  invalid_credentials: "error",
  email_not_confirmed: "error",
  weak_password: "error",
  password_mismatch: "error",
  password_unchanged: "error",
  email_sign_in_failed: "error",
  email_sign_up_failed: "error",
  password_reset_failed: "error",
  password_update_failed: "error",
  too_many_requests: "error",
  confirmation_link_invalid: "error",
  recovery_link_invalid: "error",
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
  "/auth/confirm",
  "/auth/continue",
  "/auth/update-password",
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

export type CampusUniversityId = "umd" | "umb"

const UMB_CAMPUS_DOMAINS = new Set<CampusDomain>([
  "umaryland.edu",
  "rx.maryland.edu",
])

export function campusUniversityForEmail(value: string): CampusUniversityId | null {
  const normalized = normalizeCampusEmail(value)
  if (!normalized) {
    return null
  }

  const domain = normalized.slice(normalized.lastIndexOf("@") + 1) as CampusDomain
  return UMB_CAMPUS_DOMAINS.has(domain) ? "umb" : "umd"
}

export const GOOGLE_PROVIDER = "google"
export const EMAIL_PROVIDER = "email"

/**
 * The only two ways an account is allowed to authenticate. Phone, SSO, anonymous, and the
 * other social logins stay rejected, and attaching one of them to an account disqualifies
 * that account even though its other identities are allowed.
 */
export const ALLOWED_AUTH_PROVIDERS = [GOOGLE_PROVIDER, EMAIL_PROVIDER] as const

export type AllowedAuthProvider = (typeof ALLOWED_AUTH_PROVIDERS)[number]

interface ProviderAwareUser {
  app_metadata?: unknown
  identities?: unknown
  is_anonymous?: unknown
}

function isAllowedProvider(value: unknown): value is AllowedAuthProvider {
  return (
    typeof value === "string" &&
    (ALLOWED_AUTH_PROVIDERS as readonly string[]).includes(value)
  )
}

/**
 * Establishes that every login method attached to the account is one this application
 * supports. Supabase links a Google and a password identity that share a confirmed campus
 * address into one account, so the check has to accept a mixed set rather than a single
 * provider while still rejecting anything outside the allowed pair.
 *
 * This deliberately avoids `identities[].last_sign_in_at`: GoTrue writes that field when
 * an identity is created and never refreshes it, so comparing it against the user's
 * `last_sign_in_at` rejects every returning user. `app_metadata.provider`,
 * `app_metadata.providers`, and the identity list are the fields GoTrue keeps current.
 */
export function isAllowedProviderAccount(user: unknown): boolean {
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

  if (!appMetadata || !isAllowedProvider(appMetadata.provider)) {
    return false
  }

  // `providers` lists every linked login method for the account.
  if (
    !Array.isArray(appMetadata.providers) ||
    appMetadata.providers.length === 0 ||
    !appMetadata.providers.every(isAllowedProvider)
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
    return isAllowedProvider((value as { provider?: unknown }).provider)
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
