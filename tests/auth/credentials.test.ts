import { describe, expect, it } from "vitest"
import {
  mapAuthError,
  validateCampusEmail,
  validateNewPassword,
  validateSignIn,
  validateSignUp,
} from "@/lib/auth/credentials"

describe("campus email entry", () => {
  it.each([
    ["  Student@UMD.EDU ", "student@umd.edu"],
    ["  Terp@TerpMail.UMD.EDU ", "terp@terpmail.umd.edu"],
  ])("normalizes an eligible address: %s", (email, expected) => {
    expect(validateCampusEmail(email)).toEqual({ ok: true, value: expected })
  })

  it.each([
    "student@gmail.com",
    "student@mail.umd.edu",
    "student@mail.terpmail.umd.edu",
    "student",
    "",
  ])(
    "rejects an ineligible address: %s",
    (email) => {
      expect(validateCampusEmail(email)).toEqual({
        ok: false,
        errorCode: "invalid_campus_email",
      })
    }
  )
})

describe("password sign-in entry", () => {
  it("accepts an rx.maryland.edu address", () => {
    expect(
      validateSignIn({ email: " Pharmacy@RX.MARYLAND.EDU ", password: "correct horse" })
    ).toEqual({
      ok: true,
      value: { email: "pharmacy@rx.maryland.edu", password: "correct horse" },
    })
  })

  it("passes the normalized address and the password through", () => {
    expect(validateSignIn({ email: "Student@umd.edu", password: "correct horse" })).toEqual({
      ok: true,
      value: { email: "student@umd.edu", password: "correct horse" },
    })
  })

  it("rejects an ineligible address before contacting the auth service", () => {
    expect(validateSignIn({ email: "student@gmail.com", password: "correct horse" })).toEqual({
      ok: false,
      errorCode: "invalid_campus_email",
    })
  })

  it("reports an empty password as a failed credential", () => {
    expect(validateSignIn({ email: "student@umd.edu", password: "" })).toEqual({
      ok: false,
      errorCode: "invalid_credentials",
    })
  })

  // Sign-in must not apply the sign-up length rule: doing so would answer for the auth
  // service and reveal that the rejection came from the password's shape.
  it("accepts a short password and lets the auth service decide", () => {
    expect(validateSignIn({ email: "student@umd.edu", password: "short" }).ok).toBe(true)
  })
})

describe("account creation entry", () => {
  it("creates credentials for an rx.maryland.edu address", () => {
    expect(
      validateSignUp({
        email: " Pharmacy@RX.MARYLAND.EDU ",
        password: "terrapin24",
        confirmation: "terrapin24",
      })
    ).toEqual({
      ok: true,
      value: { email: "pharmacy@rx.maryland.edu", password: "terrapin24" },
    })
  })

  it("accepts a matching password of sufficient length", () => {
    expect(
      validateSignUp({
        email: "Student@UMD.edu",
        password: "terrapin24",
        confirmation: "terrapin24",
      })
    ).toEqual({ ok: true, value: { email: "student@umd.edu", password: "terrapin24" } })
  })

  it("rejects an ineligible address before checking the password", () => {
    expect(
      validateSignUp({ email: "student@gmail.com", password: "short", confirmation: "other" })
    ).toEqual({ ok: false, errorCode: "invalid_campus_email" })
  })

  it.each([
    ["a password below the minimum length", "terp24", "terp24", "weak_password"],
    ["a mistyped confirmation", "terrapin24", "terrapin25", "password_mismatch"],
  ])("rejects %s", (_label, password, confirmation, errorCode) => {
    expect(validateSignUp({ email: "student@umd.edu", password, confirmation })).toEqual({
      ok: false,
      errorCode,
    })
  })
})

describe("password replacement entry", () => {
  it("accepts a matching password of sufficient length", () => {
    expect(validateNewPassword("terrapin24", "terrapin24")).toEqual({
      ok: true,
      value: "terrapin24",
    })
  })

  it.each([
    ["too short", "terp24", "terp24", "weak_password"],
    ["mismatched", "terrapin24", "terrapin25", "password_mismatch"],
  ])("rejects a %s password", (_label, password, confirmation, errorCode) => {
    expect(validateNewPassword(password, confirmation)).toEqual({ ok: false, errorCode })
  })
})

describe("auth service error mapping", () => {
  it.each([
    ["invalid_credentials", "invalid_credentials"],
    ["email_not_confirmed", "email_not_confirmed"],
    ["weak_password", "weak_password"],
    ["same_password", "password_unchanged"],
    ["over_request_rate_limit", "too_many_requests"],
    ["over_email_send_rate_limit", "too_many_requests"],
    ["otp_expired", "recovery_link_invalid"],
  ])("translates %s into an actionable message code", (code, expected) => {
    expect(mapAuthError({ code }, "email_sign_in_failed")).toBe(expected)
  })

  it("treats an unattributed rate limit as too many attempts", () => {
    expect(mapAuthError({ status: 429 }, "email_sign_in_failed")).toBe("too_many_requests")
  })

  // Reporting this back would confirm that an address is registered, which is exactly what
  // Supabase's enumeration protection exists to prevent.
  it("does not surface that an account already exists", () => {
    expect(mapAuthError({ code: "user_already_exists" }, "email_sign_up_failed")).toBe(
      "email_sign_up_failed"
    )
  })

  it.each([
    ["an unrecognized code", { code: "some_new_gotrue_code" }],
    ["a transport failure", { name: "AuthRetryableFetchError" }],
    ["a plain error", new Error("network detail")],
    ["nothing", null],
    ["a string", "boom"],
  ])("falls back to the caller's generic failure for %s", (_label, error) => {
    expect(mapAuthError(error, "password_reset_failed")).toBe("password_reset_failed")
  })
})
