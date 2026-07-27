import { normalizeReturnPath } from "@/lib/auth/policy"

export function createGoogleOAuthOptions(origin: string, next: string | null) {
  const returnTo = normalizeReturnPath(next)
  const callback = new URL("/auth/callback", origin)
  callback.searchParams.set("next", returnTo)

  return {
    provider: "google" as const,
    options: {
      redirectTo: callback.toString(),
      queryParams: {
        prompt: "select_account",
      },
    },
  }
}
