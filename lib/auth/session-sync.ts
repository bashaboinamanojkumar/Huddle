import {
  isAllowedProviderAccount,
  isEligibleCampusEmail,
  type AuthErrorCode,
} from "@/lib/auth/policy"

export interface LocalSessionSnapshot {
  userId: string
  expiresAt: string
}

/**
 * A failed lookup is not the same as a signed-out user. Treating an unreachable auth
 * service as "signed out" would sign the browser out and bounce it to `/verify`, which
 * the proxy sends straight back while the cookie is still valid.
 */
export type AuthUserLookup =
  | { status: "authenticated"; user: unknown }
  | { status: "unauthenticated" }
  | { status: "unavailable" }

export type SessionSyncDecision =
  | { kind: "ready" }
  | { kind: "adopt" }
  | { kind: "reject"; errorCode: AuthErrorCode }
  | { kind: "unavailable" }

interface EligibilityCandidate {
  email?: unknown
  email_confirmed_at?: unknown
}

export function isEligibleAuthUser(user: unknown): boolean {
  if (!user || typeof user !== "object") {
    return false
  }

  const candidate = user as EligibilityCandidate
  return (
    typeof candidate.email === "string" &&
    isEligibleCampusEmail(candidate.email) &&
    Boolean(candidate.email_confirmed_at) &&
    isAllowedProviderAccount(user)
  )
}

function isUnexpired(localSession: LocalSessionSnapshot | null, now: Date): boolean {
  if (!localSession) {
    return false
  }
  const expiresAt = Date.parse(localSession.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt > now.getTime()
}

function matchesLocalSession(
  localSession: LocalSessionSnapshot | null,
  userId: unknown,
  now: Date
): boolean {
  if (!localSession || typeof userId !== "string" || localSession.userId !== userId) {
    return false
  }
  return isUnexpired(localSession, now)
}

/**
 * Local state is presentation-only and can outlive a Supabase session, so protected
 * screens must reconcile the two before rendering. Without this the seeded demo profile
 * would stand in for a real signed-in student.
 */
export function decideSessionSync(input: {
  lookup: AuthUserLookup
  localSession: LocalSessionSnapshot | null
  now: Date
}): SessionSyncDecision {
  const { lookup, localSession, now } = input

  if (lookup.status === "unauthenticated") {
    return { kind: "reject", errorCode: "session_expired" }
  }

  if (lookup.status === "unavailable") {
    // Route access was already validated server-side for this request, so an existing
    // association stays usable offline. Without one there is no identity to render.
    return isUnexpired(localSession, now) ? { kind: "ready" } : { kind: "unavailable" }
  }

  if (!isEligibleAuthUser(lookup.user)) {
    return { kind: "reject", errorCode: "campus_account_required" }
  }

  const { id } = lookup.user as { id?: unknown }
  return matchesLocalSession(localSession, id, now) ? { kind: "ready" } : { kind: "adopt" }
}
