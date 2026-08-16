import { NextResponse, type NextRequest } from "next/server"
import {
  classifyAuthFailure,
  summarizeCallbackUser,
  type AuthCallbackResult,
} from "@/lib/auth/callback"
import {
  EMAIL_CONFIRMATION_COOKIE,
  isConfirmableOtpType,
  processEmailConfirmation,
} from "@/lib/auth/confirm"
import { normalizeReturnPath } from "@/lib/auth/policy"
import { createClient } from "@/lib/supabase/server"

function stageTokenHashConfirmation(request: NextRequest): NextResponse | null {
  if (
    request.nextUrl.searchParams.get("error") ||
    request.nextUrl.searchParams.get("error_code")
  ) {
    return null
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash")
  const type = request.nextUrl.searchParams.get("type")

  if (!tokenHash || !isConfirmableOtpType(type)) {
    return null
  }

  const search = new URLSearchParams({
    kind: "token_hash",
    type,
    next: normalizeReturnPath(request.nextUrl.searchParams.get("next")),
  })
  const response = NextResponse.redirect(
    new URL(`/auth/confirm/review?${search.toString()}`, request.url)
  )
  response.cookies.set(EMAIL_CONFIRMATION_COOKIE, tokenHash, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/auth/confirm",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  })
  return response
}

async function completeEmailConfirmation(
  request: NextRequest,
  confirmationUrl: URL,
  redirectStatus: 303 | 307 = 307
) {
  let result: AuthCallbackResult
  try {
    const supabase = await createClient()
    result = await processEmailConfirmation(confirmationUrl, {
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
      next: normalizeReturnPath(confirmationUrl.searchParams.get("next")),
    })
    result = {
      destination: `/verify?${search.toString()}`,
      errorCode: "confirmation_link_invalid",
    }
  }

  if (result.errorCode) {
    console.warn(`Email link rejected: ${result.errorCode}`)
  }

  return NextResponse.redirect(new URL(result.destination, request.url), redirectStatus)
}

export async function GET(request: NextRequest) {
  const staged = stageTokenHashConfirmation(request)
  if (staged) {
    return staged
  }

  return completeEmailConfirmation(request, request.nextUrl)
}

export async function POST(request: NextRequest) {
  const confirmationUrl = new URL(request.url)
  confirmationUrl.search = ""

  try {
    const form = await request.formData()
    const credential = request.cookies.get(EMAIL_CONFIRMATION_COOKIE)?.value
    const kind = form.get("kind")
    const type = form.get("type")
    const next = form.get("next")

    if (credential && kind === "token_hash" && typeof type === "string") {
      confirmationUrl.searchParams.set("token_hash", credential)
      confirmationUrl.searchParams.set("type", type)
    }
    if (typeof next === "string") {
      confirmationUrl.searchParams.set("next", next)
    }
  } catch {
    // An unreadable or incomplete form is handled as an invalid one-time link below.
  }

  const response = await completeEmailConfirmation(request, confirmationUrl, 303)
  response.cookies.set(EMAIL_CONFIRMATION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/auth/confirm",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  })
  return response
}
