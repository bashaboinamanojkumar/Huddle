/**
 * Supabase SSR stores the session under `sb-<project-ref>-auth-token`, splitting an
 * oversized token into `.0`, `.1` chunks.
 *
 * The `-code-verifier` cookie written while a sign-in is still in flight is deliberately
 * excluded: a pending sign-in is not evidence of a session that has since lapsed.
 */
const SESSION_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/

export function hasSupabaseSessionCookie(names: Iterable<string>): boolean {
  for (const name of names) {
    if (SESSION_COOKIE_PATTERN.test(name)) {
      return true
    }
  }
  return false
}
