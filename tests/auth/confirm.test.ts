import { describe, expect, it, vi } from "vitest"
import { processEmailConfirmation, type ConfirmAuth } from "@/lib/auth/confirm"

function createAuth(overrides: Partial<ConfirmAuth> = {}): ConfirmAuth {
  return {
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "Student@UMD.edu",
          email_confirmed_at: "2026-07-25T12:00:00.000Z",
          app_metadata: { provider: "email", providers: ["email"] },
          identities: [{ provider: "email" }],
        },
      },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
}

const CONFIRM_URL = "https://hurdle.example/auth/confirm"

describe("email confirmation links", () => {
  it("verifies a signup token and continues to the profile bridge", async () => {
    const auth = createAuth()
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=hash-abc&type=signup&next=%2Fapp%2Fchats`),
      auth
    )

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-abc", type: "signup" })
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(result).toEqual({
      destination: "/auth/continue?next=%2Fapp%2Fchats",
      errorCode: null,
    })
  })

  it("verifies a recovery token and sends the student to choose a password", async () => {
    const auth = createAuth()
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=hash-abc&type=recovery&next=%2Fapp`),
      auth
    )

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-abc", type: "recovery" })
    expect(result).toEqual({
      destination: "/auth/update-password?next=%2Fapp",
      errorCode: null,
    })
  })

  it("accepts the confirmation type used by the stock Supabase template", async () => {
    const auth = createAuth()
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=hash-abc&type=email`),
      auth
    )

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-abc", type: "email" })
    expect(result).toEqual({ destination: "/auth/continue?next=%2Fapp", errorCode: null })
  })

  // The stock Supabase template sends a PKCE code instead of a token hash, so the route has
  // to keep working for a project that has not applied the template change yet.
  it("exchanges a PKCE code when the link carries no token hash", async () => {
    const auth = createAuth()
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?code=pkce-code&next=%2Fapp`),
      auth
    )

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code")
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(result).toEqual({ destination: "/auth/continue?next=%2Fapp", errorCode: null })
  })

  it("keeps a coded recovery link on the recovery path", async () => {
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?code=pkce-code&flow=recovery&next=%2Fapp`),
      createAuth()
    )

    expect(result).toEqual({
      destination: "/auth/update-password?next=%2Fapp",
      errorCode: null,
    })
  })

  it("falls back to the default destination for an unsafe return path", async () => {
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=hash-abc&type=signup&next=https%3A%2F%2Fevil.test`),
      createAuth()
    )

    expect(result.destination).toBe("/auth/continue?next=%2Fapp")
  })

  it.each([
    ["no credential at all", `${CONFIRM_URL}?next=%2Fapp`],
    ["a token hash with no type", `${CONFIRM_URL}?token_hash=hash-abc`],
    ["a token hash for an unsupported flow", `${CONFIRM_URL}?token_hash=hash-abc&type=magiclink`],
    ["a provider error", `${CONFIRM_URL}?error=access_denied&error_code=otp_expired`],
  ])("rejects a link with %s", async (_label, url) => {
    const auth = createAuth()
    const result = await processEmailConfirmation(new URL(url), auth)

    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(result.errorCode).toBe("confirmation_link_invalid")
    expect(result.destination).toContain("error=confirmation_link_invalid")
  })

  it.each([
    ["signup", "confirmation_link_invalid"],
    ["recovery", "recovery_link_invalid"],
  ])("reports an expired %s token with its own message", async (type, errorCode) => {
    const auth = createAuth({
      verifyOtp: vi.fn().mockResolvedValue({ error: { code: "otp_expired" } }),
    })
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=stale&type=${type}`),
      auth
    )

    expect(result.errorCode).toBe(errorCode)
  })

  it("does not leak the token when verification throws", async () => {
    const auth = createAuth({
      verifyOtp: vi.fn().mockRejectedValue(new Error("token hash-secret rejected")),
    })
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=hash-secret&type=signup`),
      auth
    )

    expect(result).toEqual({
      destination: "/verify?error=confirmation_link_invalid&next=%2Fapp",
      errorCode: "confirmation_link_invalid",
    })
    expect(result.destination).not.toContain("hash-secret")
  })

  it("signs out a confirmed account outside the campus domains", async () => {
    const auth = createAuth({
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "student@gmail.com",
            email_confirmed_at: "2026-07-25T12:00:00.000Z",
            app_metadata: { provider: "email", providers: ["email"] },
            identities: [{ provider: "email" }],
          },
        },
        error: null,
      }),
    })
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=hash-abc&type=signup`),
      auth
    )

    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(result.errorCode).toBe("campus_account_required")
  })

  it("signs out an account whose email is still unverified after the exchange", async () => {
    const auth = createAuth({
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123", email: "student@umd.edu" } },
        error: null,
      }),
    })
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=hash-abc&type=signup`),
      auth
    )

    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(result.errorCode).toBe("missing_email")
  })

  it("rejects a verified token that produced no session", async () => {
    const auth = createAuth({
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    })
    const result = await processEmailConfirmation(
      new URL(`${CONFIRM_URL}?token_hash=hash-abc&type=recovery`),
      auth
    )

    expect(result.errorCode).toBe("recovery_link_invalid")
  })
})
