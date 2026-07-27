import { normalizeReturnPath, type AuthErrorCode } from "@/lib/auth/policy"

/**
 * `anonymous` and `expired` both mean "no usable session", but they are kept apart so the
 * verification page can prompt a first-time visitor without claiming a session lapsed.
 */
export type AuthState = "anonymous" | "expired" | "eligible" | "ineligible"

export type RouteDecision =
  | { kind: "next" }
  | { kind: "redirect"; destination: string }

const AUTH_ENTRY_PATHS = new Set(["/verify", "/login", "/signup"])

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/")
  )
}

function verificationRedirect(
  error: AuthErrorCode,
  requestedPath: string
): RouteDecision {
  const search = new URLSearchParams({
    error,
    next: normalizeReturnPath(requestedPath),
  })
  return { kind: "redirect", destination: `/verify?${search.toString()}` }
}

export function decideAuthRoute(url: URL, authState: AuthState): RouteDecision {
  const requestedPath = `${url.pathname}${url.search}`
  const isAuthEntry = AUTH_ENTRY_PATHS.has(url.pathname)
  const isProtected = isProtectedPath(url.pathname)

  if (authState === "eligible" && isAuthEntry) {
    return {
      kind: "redirect",
      destination: normalizeReturnPath(url.searchParams.get("next")),
    }
  }

  if (authState === "ineligible") {
    if (url.pathname === "/verify") {
      return { kind: "next" }
    }
    if (isProtected || isAuthEntry) {
      return verificationRedirect("campus_account_required", requestedPath)
    }
  }

  if ((authState === "anonymous" || authState === "expired") && isProtected) {
    return verificationRedirect(
      authState === "expired" ? "session_expired" : "sign_in_required",
      requestedPath
    )
  }

  return { kind: "next" }
}
