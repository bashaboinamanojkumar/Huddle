import { describe, expect, it } from "vitest"
import { decideAuthRoute } from "@/lib/auth/routing"

describe("authenticated route decisions", () => {
  it.each(["/", "/crisis", "/offline", "/auth/callback", "/auth/continue"])(
    "keeps a public route public: %s",
    (path) => {
      expect(decideAuthRoute(new URL(path, "https://hurdle.example"), "anonymous")).toEqual({
        kind: "next",
      })
    }
  )

  it.each([
    ["/app", "/verify?error=sign_in_required&next=%2Fapp"],
    [
      "/app/activity/123?tab=chat",
      "/verify?error=sign_in_required&next=%2Fapp%2Factivity%2F123%3Ftab%3Dchat",
    ],
    ["/onboarding", "/verify?error=sign_in_required&next=%2Fonboarding"],
  ])("prompts a never-signed-in visitor rather than claiming an expiry: %s", (path, destination) => {
    expect(decideAuthRoute(new URL(path, "https://hurdle.example"), "anonymous")).toEqual({
      kind: "redirect",
      destination,
    })
  })

  it.each([
    ["/app", "/verify?error=session_expired&next=%2Fapp"],
    ["/onboarding", "/verify?error=session_expired&next=%2Fonboarding"],
  ])("reports an expiry when a session cookie was carried: %s", (path, destination) => {
    expect(decideAuthRoute(new URL(path, "https://hurdle.example"), "expired")).toEqual({
      kind: "redirect",
      destination,
    })
  })

  it.each(["/", "/crisis", "/verify", "/login"])(
    "leaves an expired session on a public or auth entry page: %s",
    (path) => {
      expect(decideAuthRoute(new URL(path, "https://hurdle.example"), "expired")).toEqual({
        kind: "next",
      })
    }
  )

  it.each(["/verify", "/login", "/signup"])(
    "moves an eligible user away from an auth entry page: %s",
    (path) => {
      const url = new URL(`${path}?next=%2Fapp%2Fchats`, "https://hurdle.example")
      expect(decideAuthRoute(url, "eligible")).toEqual({
        kind: "redirect",
        destination: "/app/chats",
      })
    }
  )

  it("rejects an unsafe auth-page continuation", () => {
    const url = new URL("/verify?next=%2F%2Fevil.example", "https://hurdle.example")
    expect(decideAuthRoute(url, "eligible")).toEqual({
      kind: "redirect",
      destination: "/app",
    })
  })

  it("rejects an ineligible session before protected content renders", () => {
    const url = new URL("/app/admin/review", "https://hurdle.example")
    expect(decideAuthRoute(url, "ineligible")).toEqual({
      kind: "redirect",
      destination:
        "/verify?error=campus_account_required&next=%2Fapp%2Fadmin%2Freview",
    })
  })

  it("allows the verification page to show an ineligible-account error", () => {
    const url = new URL(
      "/verify?error=campus_account_required&next=%2Fapp",
      "https://hurdle.example"
    )
    expect(decideAuthRoute(url, "ineligible")).toEqual({ kind: "next" })
  })

  it("keeps eligible users on protected routes", () => {
    expect(
      decideAuthRoute(new URL("/app/admin/review", "https://hurdle.example"), "eligible")
    ).toEqual({ kind: "next" })
  })
})
