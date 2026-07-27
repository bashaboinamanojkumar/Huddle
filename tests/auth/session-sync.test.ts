import { describe, expect, it } from "vitest"
import {
  decideSessionSync,
  type AuthUserLookup,
  type LocalSessionSnapshot,
} from "@/lib/auth/session-sync"

const NOW = new Date("2026-07-26T12:00:00.000Z")

function googleUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "8f14e45f-ceea-467a-9f5f-1c1c1c1c1c1c",
    email: "terp@umd.edu",
    email_confirmed_at: "2026-07-01T00:00:00.000Z",
    // Trails the session timestamp, as GoTrue leaves it after the first sign-in.
    last_sign_in_at: "2026-07-26T11:59:00.000Z",
    app_metadata: { provider: "google", providers: ["google"] },
    identities: [
      { provider: "google", last_sign_in_at: "2026-07-01T00:00:00.000Z" },
    ],
    ...overrides,
  }
}

function authenticated(overrides: Record<string, unknown> = {}): AuthUserLookup {
  return { status: "authenticated", user: googleUser(overrides) }
}

function localSession(overrides: Partial<LocalSessionSnapshot> = {}): LocalSessionSnapshot {
  return {
    userId: "8f14e45f-ceea-467a-9f5f-1c1c1c1c1c1c",
    expiresAt: "2026-08-25T12:00:00.000Z",
    ...overrides,
  }
}

describe("protected session synchronization", () => {
  it("renders protected content when the local session matches the Supabase user", () => {
    expect(
      decideSessionSync({ lookup: authenticated(), localSession: localSession(), now: NOW })
    ).toEqual({ kind: "ready" })
  })

  it("adopts the Supabase identity when no local session exists", () => {
    expect(
      decideSessionSync({ lookup: authenticated(), localSession: null, now: NOW })
    ).toEqual({ kind: "adopt" })
  })

  it("adopts the Supabase identity when the local session belongs to another user", () => {
    expect(
      decideSessionSync({
        lookup: authenticated(),
        localSession: localSession({ userId: "user-you" }),
        now: NOW,
      })
    ).toEqual({ kind: "adopt" })
  })

  it("adopts the Supabase identity when the local association has expired", () => {
    expect(
      decideSessionSync({
        lookup: authenticated(),
        localSession: localSession({ expiresAt: "2026-07-25T12:00:00.000Z" }),
        now: NOW,
      })
    ).toEqual({ kind: "adopt" })
  })

  it("adopts the Supabase identity when the local expiry is unreadable", () => {
    expect(
      decideSessionSync({
        lookup: authenticated(),
        localSession: localSession({ expiresAt: "not-a-date" }),
        now: NOW,
      })
    ).toEqual({ kind: "adopt" })
  })

  it("rejects a signed-out browser as an expired session", () => {
    expect(
      decideSessionSync({
        lookup: { status: "unauthenticated" },
        localSession: localSession(),
        now: NOW,
      })
    ).toEqual({ kind: "reject", errorCode: "session_expired" })
  })

  it("never treats a local session alone as authentication", () => {
    expect(
      decideSessionSync({
        lookup: { status: "unauthenticated" },
        localSession: null,
        now: NOW,
      })
    ).toEqual({ kind: "reject", errorCode: "session_expired" })
  })

  it.each([
    ["a non-campus domain", { email: "person@gmail.com" }],
    ["a campus subdomain lookalike", { email: "person@mail.umd.edu" }],
    ["an unconfirmed email", { email_confirmed_at: null }],
    ["a missing email", { email: undefined }],
  ])("rejects %s even when a local session exists", (_label, overrides) => {
    expect(
      decideSessionSync({
        lookup: authenticated(overrides),
        localSession: localSession(),
        now: NOW,
      })
    ).toEqual({ kind: "reject", errorCode: "campus_account_required" })
  })

  it("rejects an account that can also sign in with a password", () => {
    const lookup = authenticated({
      app_metadata: { provider: "google", providers: ["google", "email"] },
      identities: [{ provider: "google" }, { provider: "email" }],
    })

    expect(decideSessionSync({ lookup, localSession: localSession(), now: NOW })).toEqual({
      kind: "reject",
      errorCode: "campus_account_required",
    })
  })

  describe("when the auth service cannot be reached", () => {
    const lookup: AuthUserLookup = { status: "unavailable" }

    it("keeps an unexpired association usable instead of signing the browser out", () => {
      expect(decideSessionSync({ lookup, localSession: localSession(), now: NOW })).toEqual({
        kind: "ready",
      })
    })

    it("reports unavailability rather than looping when there is no association", () => {
      expect(decideSessionSync({ lookup, localSession: null, now: NOW })).toEqual({
        kind: "unavailable",
      })
    })

    it("reports unavailability when the association has expired", () => {
      expect(
        decideSessionSync({
          lookup,
          localSession: localSession({ expiresAt: "2026-07-25T12:00:00.000Z" }),
          now: NOW,
        })
      ).toEqual({ kind: "unavailable" })
    })
  })
})
