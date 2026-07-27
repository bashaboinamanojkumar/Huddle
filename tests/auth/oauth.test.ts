import { describe, expect, it } from "vitest"
import { createGoogleOAuthOptions } from "@/lib/auth/oauth"

describe("Google OAuth options", () => {
  it("starts Google account selection through the server callback", () => {
    const request = createGoogleOAuthOptions(
      "https://hurdle.example",
      "/app/activity/activity-study-reset?tab=chat"
    )

    expect(request).toEqual({
      provider: "google",
      options: {
        redirectTo:
          "https://hurdle.example/auth/callback?next=%2Fapp%2Factivity%2Factivity-study-reset%3Ftab%3Dchat",
        queryParams: {
          prompt: "select_account",
        },
      },
    })
  })

  it("replaces an unsafe continuation with the app root", () => {
    const request = createGoogleOAuthOptions("https://hurdle.example", "//evil.example")
    expect(request.options.redirectTo).toBe(
      "https://hurdle.example/auth/callback?next=%2Fapp"
    )
  })
})
