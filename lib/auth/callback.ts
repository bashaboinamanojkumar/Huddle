import {
  type AuthErrorCode,
  isGoogleOnlyAccount,
  normalizeCampusEmail,
  normalizeReturnPath,
} from "@/lib/auth/policy"

export interface CallbackUser {
  id: string
  email?: string
  email_confirmed_at?: string
  app_metadata?: unknown
  identities?: Array<{
    provider?: string
  }>
}

export interface CallbackAuth {
  exchangeCodeForSession: (code: string) => Promise<{ error: unknown | null }>
  getUser: () => Promise<{
    data: { user: CallbackUser | null }
    error: unknown | null
  }>
  signOut: () => Promise<{ error: unknown | null }>
}

export interface AuthCallbackResult {
  destination: string
  errorCode: AuthErrorCode | null
}

export type AuthFailureReason =
  | "pkce_verifier_missing"
  | "bad_code_verifier"
  | "network_error"
  | "auth_api_error"
  | "unknown"

export function classifyAuthFailure(error: unknown): AuthFailureReason {
  if (!error || typeof error !== "object") {
    return "unknown"
  }

  const candidate = error as { name?: unknown; code?: unknown }
  if (candidate.name === "AuthPKCECodeVerifierMissingError") {
    return "pkce_verifier_missing"
  }
  if (candidate.code === "bad_code_verifier") {
    return "bad_code_verifier"
  }
  if (candidate.name === "AuthRetryableFetchError" || candidate.name === "TypeError") {
    return "network_error"
  }
  if (candidate.name === "AuthApiError") {
    return "auth_api_error"
  }

  return "unknown"
}

export function summarizeCallbackUser(user: unknown): string {
  const candidate =
    user && typeof user === "object" ? (user as CallbackUser) : ({} as CallbackUser)
  const appMetadata =
    candidate.app_metadata && typeof candidate.app_metadata === "object"
      ? (candidate.app_metadata as { provider?: unknown; providers?: unknown })
      : {}
  const identities = Array.isArray(candidate.identities) ? candidate.identities : []
  const linkedProviders = Array.isArray(appMetadata.providers)
    ? appMetadata.providers.join("+")
    : "none"

  return [
    `email_present=${Boolean(candidate.email)}`,
    `email_confirmed=${Boolean(candidate.email_confirmed_at)}`,
    `eligible_domain=${Boolean(candidate.email && normalizeCampusEmail(candidate.email))}`,
    `app_provider_google=${appMetadata.provider === "google"}`,
    `linked_providers=${linkedProviders}`,
    `identity_providers=${identities.map((identity) => identity.provider ?? "unknown").join("+") || "none"}`,
    `google_only_account=${isGoogleOnlyAccount(candidate)}`,
  ].join(" ")
}

function verifyDestination(code: AuthErrorCode, next: string): AuthCallbackResult {
  const search = new URLSearchParams({ error: code, next })
  return {
    destination: `/verify?${search.toString()}`,
    errorCode: code,
  }
}

async function safeSignOut(auth: CallbackAuth): Promise<void> {
  try {
    await auth.signOut()
  } catch {
    // The identity is still rejected even if the provider cannot revoke locally.
  }
}

export async function processAuthCallback(
  url: URL,
  auth: CallbackAuth
): Promise<AuthCallbackResult> {
  const next = normalizeReturnPath(url.searchParams.get("next"))
  const providerError = url.searchParams.get("error")
  const providerErrorCode = url.searchParams.get("error_code")

  if (providerError || providerErrorCode) {
    const code =
      providerError === "access_denied" || providerErrorCode === "access_denied"
        ? "oauth_cancelled"
        : "invalid_callback"
    return verifyDestination(code, next)
  }

  const code = url.searchParams.get("code")
  if (!code) {
    return verifyDestination("invalid_callback", next)
  }

  let user: CallbackUser | null
  try {
    const exchange = await auth.exchangeCodeForSession(code)
    if (exchange.error) {
      return verifyDestination("invalid_callback", next)
    }

    const result = await auth.getUser()
    if (result.error) {
      return verifyDestination("invalid_callback", next)
    }
    user = result.data.user
  } catch {
    return verifyDestination("invalid_callback", next)
  }

  if (!user) {
    return verifyDestination("invalid_callback", next)
  }

  if (!user.email || !user.email_confirmed_at) {
    await safeSignOut(auth)
    return verifyDestination("missing_email", next)
  }

  if (!isGoogleOnlyAccount(user) || !normalizeCampusEmail(user.email)) {
    await safeSignOut(auth)
    return verifyDestination("campus_account_required", next)
  }

  const search = new URLSearchParams({ next })
  return {
    destination: `/auth/continue?${search.toString()}`,
    errorCode: null,
  }
}
