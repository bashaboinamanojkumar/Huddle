import { NextResponse, type NextRequest } from "next/server"
import {
  classifyAuthFailure,
  summarizeCallbackUser,
  type AuthCallbackResult,
} from "@/lib/auth/callback"
import { processEmailConfirmation } from "@/lib/auth/confirm"
import { normalizeReturnPath } from "@/lib/auth/policy"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  let result: AuthCallbackResult
  try {
    const supabase = await createClient()
    result = await processEmailConfirmation(request.nextUrl, {
      verifyOtp: async (params) => {
        try {
          const verification = await supabase.auth.verifyOtp(params)
          if (verification.error) {
            console.warn(
              `Email link verification failed: ${classifyAuthFailure(verification.error)}`
            )
          }
          return verification
        } catch (error) {
          console.warn(`Email link verification failed: ${classifyAuthFailure(error)}`)
          throw error
        }
      },
      exchangeCodeForSession: async (code) => {
        try {
          const exchange = await supabase.auth.exchangeCodeForSession(code)
          if (exchange.error) {
            console.warn(`Email link exchange failed: ${classifyAuthFailure(exchange.error)}`)
          }
          return exchange
        } catch (error) {
          console.warn(`Email link exchange failed: ${classifyAuthFailure(error)}`)
          throw error
        }
      },
      getUser: async () => {
        try {
          const userResult = await supabase.auth.getUser()
          if (userResult.error) {
            console.warn(
              `Email link user lookup failed: ${classifyAuthFailure(userResult.error)}`
            )
          } else if (userResult.data.user) {
            console.info(`Email link user checks: ${summarizeCallbackUser(userResult.data.user)}`)
          }
          return userResult
        } catch (error) {
          console.warn(`Email link user lookup failed: ${classifyAuthFailure(error)}`)
          throw error
        }
      },
      signOut: () => supabase.auth.signOut(),
    })
  } catch {
    const search = new URLSearchParams({
      error: "confirmation_link_invalid",
      next: normalizeReturnPath(request.nextUrl.searchParams.get("next")),
    })
    result = {
      destination: `/verify?${search.toString()}`,
      errorCode: "confirmation_link_invalid",
    }
  }

  if (result.errorCode) {
    console.warn(`Email link rejected: ${result.errorCode}`)
  }

  return NextResponse.redirect(new URL(result.destination, request.url))
}
