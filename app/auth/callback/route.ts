import { NextResponse, type NextRequest } from "next/server"
import {
  classifyAuthFailure,
  processAuthCallback,
  summarizeCallbackUser,
  type AuthCallbackResult,
} from "@/lib/auth/callback"
import { normalizeReturnPath } from "@/lib/auth/policy"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  let result: AuthCallbackResult
  try {
    const supabase = await createClient()
    result = await processAuthCallback(request.nextUrl, {
      exchangeCodeForSession: async (code) => {
        try {
          const exchange = await supabase.auth.exchangeCodeForSession(code)
          if (exchange.error) {
            console.warn(
              `OAuth exchange failed: ${classifyAuthFailure(exchange.error)}`
            )
          }
          return exchange
        } catch (error) {
          console.warn(`OAuth exchange failed: ${classifyAuthFailure(error)}`)
          throw error
        }
      },
      getUser: async () => {
        try {
          const userResult = await supabase.auth.getUser()
          if (userResult.error) {
            console.warn(
              `OAuth user lookup failed: ${classifyAuthFailure(userResult.error)}`
            )
          } else if (userResult.data.user) {
            console.info(`OAuth user checks: ${summarizeCallbackUser(userResult.data.user)}`)
          }
          return userResult
        } catch (error) {
          console.warn(`OAuth user lookup failed: ${classifyAuthFailure(error)}`)
          throw error
        }
      },
      signOut: () => supabase.auth.signOut(),
    })
  } catch {
    const search = new URLSearchParams({
      error: "invalid_callback",
      next: normalizeReturnPath(request.nextUrl.searchParams.get("next")),
    })
    result = {
      destination: `/verify?${search.toString()}`,
      errorCode: "invalid_callback",
    }
  }

  if (result.errorCode) {
    console.warn(`OAuth callback rejected: ${result.errorCode}`)
  }

  return NextResponse.redirect(new URL(result.destination, request.url))
}
