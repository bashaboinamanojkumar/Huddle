import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const createClient = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({ createClient }))

import * as confirmRoute from "@/app/auth/confirm/route"

describe("email confirmation route", () => {
  beforeEach(() => {
    createClient.mockReset()
  })

  it("stages a token-hash link without consuming it during an email-scanner GET", async () => {
    const request = new NextRequest(
      "https://hurdle.example/auth/confirm?token_hash=hash-abc&type=signup&next=%2Fapp%2Fchats"
    )

    const response = await confirmRoute.GET(request)
    const location = new URL(response.headers.get("location")!)
    const setCookie = response.headers.get("set-cookie") ?? ""

    expect(createClient).not.toHaveBeenCalled()
    expect(location.pathname).toBe("/auth/confirm/review")
    expect(location.searchParams.get("kind")).toBe("token_hash")
    expect(location.searchParams.get("type")).toBe("signup")
    expect(location.searchParams.get("next")).toBe("/app/chats")
    expect(location.search).not.toContain("hash-abc")
    expect(setCookie).toContain("huddle-email-confirmation=hash-abc")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("SameSite=lax")
    expect(setCookie).toContain("Max-Age=600")
    expect(setCookie).toContain("Path=/auth/confirm")
    expect(setCookie).toContain("Secure")
  })

  it.each(["error", "error_code"])(
    "stages a valid token when %s is present but empty",
    async (parameter) => {
      const request = new NextRequest(
        `https://hurdle.example/auth/confirm?${parameter}=&token_hash=hash-abc&type=signup`
      )

      const response = await confirmRoute.GET(request)
      const location = new URL(response.headers.get("location")!)

      expect(createClient).not.toHaveBeenCalled()
      expect(location.pathname).toBe("/auth/confirm/review")
      expect(response.headers.get("set-cookie")).toContain(
        "huddle-email-confirmation=hash-abc"
      )
    }
  )

  it("does not stage a provider-rejected link even if it also contains a token hash", async () => {
    createClient.mockResolvedValue({ auth: {} })
    const request = new NextRequest(
      "https://hurdle.example/auth/confirm?error=access_denied&token_hash=hash-abc&type=signup"
    )

    const response = await confirmRoute.GET(request)
    const location = new URL(response.headers.get("location")!)

    expect(location.pathname).toBe("/verify")
    expect(location.searchParams.get("error")).toBe("confirmation_link_invalid")
    expect(response.headers.get("set-cookie")).toBeNull()
  })

  it("consumes the staged token only after the student explicitly submits the form", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null })
    createClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
              email: "student@umd.edu",
              email_confirmed_at: "2026-08-16T12:00:00.000Z",
              app_metadata: { provider: "email", providers: ["email"] },
              identities: [{ provider: "email" }],
            },
          },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        verifyOtp,
      },
    })
    const post = (
      confirmRoute as typeof confirmRoute & {
        POST?: (request: NextRequest) => Promise<Response>
      }
    ).POST

    expect(post).toBeTypeOf("function")
    if (!post) return

    const request = new NextRequest("https://hurdle.example/auth/confirm", {
      method: "POST",
      headers: {
        cookie: "huddle-email-confirmation=hash-abc",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        kind: "token_hash",
        type: "signup",
        next: "/app/chats",
      }),
    })

    const response = await post(request)

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-abc", type: "signup" })
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://hurdle.example/auth/continue?next=%2Fapp%2Fchats"
    )
    expect(response.headers.get("set-cookie")).toContain("huddle-email-confirmation=;")
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
    expect(response.headers.get("set-cookie")).toContain("Path=/auth/confirm")
  })

  it("uses a GET redirect and clears the cookie after a rejected POST", async () => {
    createClient.mockResolvedValue({ auth: {} })
    const post = confirmRoute.POST
    const request = new NextRequest("https://hurdle.example/auth/confirm", {
      method: "POST",
      headers: {
        cookie: "huddle-email-confirmation=hash-abc",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ kind: "token_hash", type: "invalid" }),
    })

    const response = await post(request)
    const location = new URL(response.headers.get("location")!)

    expect(response.status).toBe(303)
    expect(location.pathname).toBe("/verify")
    expect(location.searchParams.get("error")).toBe("confirmation_link_invalid")
    expect(response.headers.get("set-cookie")).toContain("huddle-email-confirmation=;")
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
  })

  it("redirects a successful recovery POST with 303", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null })
    createClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
              email: "student@umd.edu",
              email_confirmed_at: "2026-08-16T12:00:00.000Z",
              app_metadata: { provider: "email", providers: ["email"] },
              identities: [{ provider: "email" }],
            },
          },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        verifyOtp,
      },
    })
    const request = new NextRequest("https://hurdle.example/auth/confirm", {
      method: "POST",
      headers: {
        cookie: "huddle-email-confirmation=hash-abc",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        kind: "token_hash",
        type: "recovery",
        next: "/app/chats",
      }),
    })

    const response = await confirmRoute.POST(request)

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-abc", type: "recovery" })
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://hurdle.example/auth/update-password?next=%2Fapp%2Fchats"
    )
  })
})
