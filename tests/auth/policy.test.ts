import { describe, expect, it } from "vitest"
import {
  AUTH_ERROR_MESSAGES,
  getAuthMessage,
  isEligibleCampusEmail,
  isGoogleOnlyAccount,
  normalizeCampusEmail,
  normalizeReturnPath,
} from "@/lib/auth/policy"

describe("campus email policy", () => {
  it.each([
    [" Student@UMD.EDU ", "student@umd.edu"],
    ["researcher@umaryland.edu", "researcher@umaryland.edu"],
  ])("accepts and normalizes exact eligible domains", (input, expected) => {
    expect(normalizeCampusEmail(input)).toBe(expected)
    expect(isEligibleCampusEmail(input)).toBe(true)
  })

  it.each([
    "",
    "student",
    "@umd.edu",
    "student@",
    "student@@umd.edu",
    "student@dept.umd.edu",
    "student@evilumd.edu",
    "student@umd.edu.evil.test",
    "student@umaryland.edu.evil.test",
  ])("rejects an ineligible or malformed address: %s", (input) => {
    expect(normalizeCampusEmail(input)).toBeNull()
    expect(isEligibleCampusEmail(input)).toBe(false)
  })
})

describe("return path policy", () => {
  it.each([
    "/app",
    "/app/activity/activity-study-reset?tab=chat#latest",
    "/onboarding",
  ])("preserves a safe relative path: %s", (path) => {
    expect(normalizeReturnPath(path)).toBe(path)
  })

  it.each([
    undefined,
    null,
    "",
    "app",
    "//evil.test/path",
    "https://evil.test/path",
    "/verify?next=/app",
    "/login",
    "/signup",
    "/auth/callback?code=secret",
    "/auth/continue",
    "/\t//evil.test",
    "/\r\n//evil.test",
    "/%09//evil.test",
    "/%0d%0a//evil.test",
  ])("falls back for an unsafe or looping target: %s", (path) => {
    expect(normalizeReturnPath(path)).toBe("/app")
  })
})

describe("stable authentication errors", () => {
  it("maps every public code to a concise message", () => {
    expect(AUTH_ERROR_MESSAGES).toEqual({
      oauth_start_failed: "Google sign-in could not be started. Please try again.",
      oauth_cancelled: "Google sign-in was cancelled or denied.",
      invalid_callback: "That sign-in link is invalid or expired. Please try again.",
      missing_email: "Google did not provide a verified email address.",
      campus_account_required: "Use an eligible UMD or University of Maryland Google account.",
      session_expired: "Your session expired. Sign in again to continue.",
      sign_in_required: "Sign in with your campus Google account to continue.",
    })
  })

  it("does not display unknown provider details", () => {
    expect(getAuthMessage("access_denied: token=secret")).toBeNull()
    expect(getAuthMessage(null)).toBeNull()
  })

  it("presents a missing session as a prompt and a rejection as an error", () => {
    expect(getAuthMessage("sign_in_required")).toEqual({
      text: "Sign in with your campus Google account to continue.",
      tone: "notice",
    })
    expect(getAuthMessage("session_expired")).toEqual({
      text: "Your session expired. Sign in again to continue.",
      tone: "error",
    })
    expect(getAuthMessage("campus_account_required")).toEqual({
      text: "Use an eligible UMD or University of Maryland Google account.",
      tone: "error",
    })
  })
})

describe("authentication provider policy", () => {
  it("accepts a Google-only account", () => {
    expect(
      isGoogleOnlyAccount({
        app_metadata: { provider: "google", providers: ["google"] },
        identities: [{ provider: "google" }],
      })
    ).toBe(true)
  })

  // GoTrue stamps `identities[].last_sign_in_at` when the identity is created and never
  // refreshes it, so on every sign-in after the first it trails the user's own timestamp.
  // Treating that gap as evidence rejected every returning student.
  it("accepts a returning account whose identity timestamp trails the session", () => {
    expect(
      isGoogleOnlyAccount({
        last_sign_in_at: "2026-07-27T03:17:35.281Z",
        app_metadata: { provider: "google", providers: ["google"] },
        identities: [
          { provider: "google", last_sign_in_at: "2026-07-26T05:04:26.684Z" },
        ],
      })
    ).toBe(true)
  })

  it("rejects an account that can also sign in with a password", () => {
    expect(
      isGoogleOnlyAccount({
        app_metadata: { provider: "google", providers: ["google", "email"] },
        identities: [{ provider: "google" }, { provider: "email" }],
      })
    ).toBe(false)
  })

  it("rejects an account whose identity list contradicts its metadata", () => {
    expect(
      isGoogleOnlyAccount({
        app_metadata: { provider: "google", providers: ["google"] },
        identities: [{ provider: "google" }, { provider: "email" }],
      })
    ).toBe(false)
  })

  it("rejects an email-only account", () => {
    expect(
      isGoogleOnlyAccount({
        app_metadata: { provider: "email", providers: ["email"] },
        identities: [{ provider: "email" }],
      })
    ).toBe(false)
  })

  it("rejects an anonymous session", () => {
    expect(
      isGoogleOnlyAccount({
        is_anonymous: true,
        app_metadata: { provider: "google", providers: ["google"] },
        identities: [{ provider: "google" }],
      })
    ).toBe(false)
  })

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["an empty object", {}],
    ["metadata without a providers list", { app_metadata: { provider: "google" } }],
    [
      "an empty providers list",
      { app_metadata: { provider: "google", providers: [] }, identities: [{ provider: "google" }] },
    ],
    [
      "no identities",
      { app_metadata: { provider: "google", providers: ["google"] }, identities: [] },
    ],
    [
      "an unreadable identity entry",
      { app_metadata: { provider: "google", providers: ["google"] }, identities: [null] },
    ],
  ])("rejects unprovable provider state: %s", (_label, user) => {
    expect(isGoogleOnlyAccount(user)).toBe(false)
  })
})
