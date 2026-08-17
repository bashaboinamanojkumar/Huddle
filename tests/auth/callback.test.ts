import { describe, expect, it, vi } from "vitest"
import { processAuthCallback, type CallbackAuth } from "@/lib/auth/callback"

function createAuth(overrides: Partial<CallbackAuth> = {}): CallbackAuth {
  return {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "Student@UMD.edu",
          email_confirmed_at: "2026-07-25T12:00:00.000Z",
          // A returning student's identity timestamp trails the session timestamp.
          last_sign_in_at: "2026-07-26T09:00:00.000Z",
          app_metadata: { provider: "google", providers: ["google"] },
          identities: [
            {
              provider: "google",
              last_sign_in_at: "2026-07-25T12:00:00.000Z",
            },
          ],
        },
      },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
}

describe("OAuth callback", () => {
  it("classifies callback failures without exposing provider details", async () => {
    const callbackModule = await import("@/lib/auth/callback")
    const classifyAuthFailure = (
      callbackModule as unknown as {
        classifyAuthFailure?: (error: unknown) => string
      }
    ).classifyAuthFailure

    expect(classifyAuthFailure).toBeTypeOf("function")
    expect(
      classifyAuthFailure?.({
        name: "AuthPKCECodeVerifierMissingError",
        message: "student@umd.edu token=secret",
      })
    ).toBe("pkce_verifier_missing")
    expect(
      classifyAuthFailure?.({
        name: "AuthApiError",
        code: "bad_code_verifier",
        message: "authorization code secret",
      })
    ).toBe("bad_code_verifier")
    expect(classifyAuthFailure?.(new Error("private provider response"))).toBe(
      "unknown"
    )
  })

  it("summarizes identity eligibility without exposing user data", async () => {
    const callbackModule = await import("@/lib/auth/callback")
    const summarizeCallbackUser = (
      callbackModule as unknown as {
        summarizeCallbackUser?: (user: unknown) => string
      }
    ).summarizeCallbackUser

    expect(summarizeCallbackUser).toBeTypeOf("function")
    expect(
      summarizeCallbackUser?.({
        email: "student@umd.edu",
        email_confirmed_at: "2026-07-26T01:00:00.000Z",
        app_metadata: { provider: "google", providers: ["google", "email"] },
        identities: [{ provider: "google" }, { provider: "email" }],
      })
    ).toBe(
      "email_present=true email_confirmed=true eligible_domain=true primary_provider=google linked_providers=google+email identity_providers=google+email allowed_provider_account=true"
    )
  })

  it("exchanges the PKCE code and continues an eligible user", async () => {
    const auth = createAuth()
    const result = await processAuthCallback(
      new URL("https://hurdle.example/auth/callback?code=pkce-code&next=%2Fapp%2Fchats"),
      auth
    )

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code")
    expect(auth.getUser).toHaveBeenCalledOnce()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(result).toEqual({
      destination: "/auth/continue?next=%2Fapp%2Fchats",
      errorCode: null,
    })
  })

  it("maps provider denial to cancellation without exchanging a code", async () => {
    const auth = createAuth()
    const result = await processAuthCallback(
      new URL(
        "https://hurdle.example/auth/callback?error=access_denied&error_description=token%3Dsecret&next=%2Fapp"
      ),
      auth
    )

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(result.errorCode).toBe("oauth_cancelled")
    expect(result.destination).toBe("/verify?error=oauth_cancelled&next=%2Fapp")
    expect(result.destination).not.toContain("secret")
  })

  it.each([
    ["missing code", "https://hurdle.example/auth/callback"],
    ["unknown provider error", "https://hurdle.example/auth/callback?error=server_error"],
  ])("rejects an invalid callback: %s", async (_label, url) => {
    const result = await processAuthCallback(new URL(url), createAuth())
    expect(result.errorCode).toBe("invalid_callback")
    expect(result.destination).toContain("error=invalid_callback")
  })

  it("rejects an expired authorization code", async () => {
    const auth = createAuth({
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error("expired secret") }),
    })
    const result = await processAuthCallback(
      new URL("https://hurdle.example/auth/callback?code=expired-secret"),
      auth
    )

    expect(auth.getUser).not.toHaveBeenCalled()
    expect(result).toEqual({
      destination: "/verify?error=invalid_callback&next=%2Fapp",
      errorCode: "invalid_callback",
    })
    expect(result.destination).not.toContain("expired-secret")
  })

  it("turns an unexpected provider exception into a stable callback error", async () => {
    const auth = createAuth({
      exchangeCodeForSession: vi.fn().mockRejectedValue(new Error("network token detail")),
    })

    await expect(
      processAuthCallback(
        new URL("https://hurdle.example/auth/callback?code=pkce-secret"),
        auth
      )
    ).resolves.toEqual({
      destination: "/verify?error=invalid_callback&next=%2Fapp",
      errorCode: "invalid_callback",
    })
  })

  it.each([
    ["missing", undefined, "2026-07-25T12:00:00.000Z"],
    ["unverified", "student@umd.edu", undefined],
  ])("signs out an identity with a %s email", async (_label, email, emailConfirmedAt) => {
    const auth = createAuth({
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123", email, email_confirmed_at: emailConfirmedAt } },
        error: null,
      }),
    })
    const result = await processAuthCallback(
      new URL("https://hurdle.example/auth/callback?code=pkce-code"),
      auth
    )

    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(result.errorCode).toBe("missing_email")
  })

  it("signs out a verified account outside the two campus domains", async () => {
    const auth = createAuth({
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "student@dept.umd.edu",
            email_confirmed_at: "2026-07-25T12:00:00.000Z",
            app_metadata: { provider: "google", providers: ["google"] },
            identities: [{ provider: "google" }],
          },
        },
        error: null,
      }),
    })
    const result = await processAuthCallback(
      new URL("https://hurdle.example/auth/callback?code=pkce-code&next=%2Fapp%2Fadmin%2Freview"),
      auth
    )

    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(result).toEqual({
      destination:
        "/verify?error=campus_account_required&next=%2Fapp%2Fadmin%2Freview",
      errorCode: "campus_account_required",
    })
  })

  it("signs out a campus session held by an unsupported provider", async () => {
    const auth = createAuth({
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "student@umd.edu",
            email_confirmed_at: "2026-07-25T12:00:00.000Z",
            app_metadata: { provider: "phone", providers: ["phone"] },
            identities: [{ provider: "phone" }],
          },
        },
        error: null,
      }),
    })

    const result = await processAuthCallback(
      new URL("https://hurdle.example/auth/callback?code=pkce-code"),
      auth
    )

    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(result.errorCode).toBe("campus_account_required")
  })

  it("continues a verified rx.maryland.edu account", async () => {
    const auth = createAuth({
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-rx",
            email: "pharmacy@rx.maryland.edu",
            email_confirmed_at: "2026-08-17T12:00:00.000Z",
            app_metadata: { provider: "google", providers: ["google"] },
            identities: [{ provider: "google" }],
          },
        },
        error: null,
      }),
    })

    const result = await processAuthCallback(
      new URL("https://hurdle.example/auth/callback?code=pkce-code"),
      auth
    )

    expect(auth.signOut).not.toHaveBeenCalled()
    expect(result).toEqual({
      destination: "/auth/continue?next=%2Fapp",
      errorCode: null,
    })
  })

  it("continues a campus account that has both Google and a password linked", async () => {
    const auth = createAuth({
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "student@umd.edu",
            email_confirmed_at: "2026-07-25T13:00:00.000Z",
            app_metadata: { provider: "google", providers: ["google", "email"] },
            identities: [{ provider: "google" }, { provider: "email" }],
          },
        },
        error: null,
      }),
    })

    const result = await processAuthCallback(
      new URL("https://hurdle.example/auth/callback?code=pkce-code"),
      auth
    )

    expect(auth.signOut).not.toHaveBeenCalled()
    expect(result).toEqual({
      destination: "/auth/continue?next=%2Fapp",
      errorCode: null,
    })
  })
})
