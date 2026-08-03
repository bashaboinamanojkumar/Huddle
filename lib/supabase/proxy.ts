import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isAllowedProviderAccount, isEligibleCampusEmail } from "@/lib/auth/policy"
import { decideAuthRoute, type AuthState } from "@/lib/auth/routing"
import { hasSupabaseSessionCookie } from "@/lib/auth/session-cookies"

function responseForDecision(
  request: NextRequest,
  refreshedResponse: NextResponse,
  authState: AuthState
): NextResponse {
  const decision = decideAuthRoute(request.nextUrl, authState)
  if (decision.kind === "next") {
    return refreshedResponse
  }

  const redirectResponse = NextResponse.redirect(
    new URL(decision.destination, request.url)
  )
  refreshedResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie)
  })
  return redirectResponse
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // A carried session cookie separates a lapsed session from a visitor who never signed in.
  const signedOutState: AuthState = hasSupabaseSessionCookie(
    request.cookies.getAll().map((cookie) => cookie.name)
  )
    ? "expired"
    : "anonymous"

  if (!supabaseUrl || !supabaseKey) {
    return responseForDecision(request, supabaseResponse, signedOutState)
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  let authState: AuthState = signedOutState
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      authState =
        Boolean(user.email_confirmed_at) &&
        Boolean(user.email && isEligibleCampusEmail(user.email)) &&
        isAllowedProviderAccount(user)
          ? "eligible"
          : "ineligible"
    }
  } catch {
    authState = signedOutState
  }

  if (authState === "ineligible") {
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch {
      // Route rejection still applies if local cookie cleanup cannot complete.
    }
  }

  return responseForDecision(request, supabaseResponse, authState)
}
