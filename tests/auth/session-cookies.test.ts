import { describe, expect, it } from "vitest"
import { hasSupabaseSessionCookie } from "@/lib/auth/session-cookies"

describe("supabase session cookie detection", () => {
  it("recognizes a single session cookie", () => {
    expect(hasSupabaseSessionCookie(["sb-mxjfxkkypbnrelhfplii-auth-token"])).toBe(true)
  })

  it("recognizes a chunked session cookie", () => {
    expect(
      hasSupabaseSessionCookie([
        "sb-mxjfxkkypbnrelhfplii-auth-token.0",
        "sb-mxjfxkkypbnrelhfplii-auth-token.1",
      ])
    ).toBe(true)
  })

  it("ignores a pending sign-in's code verifier", () => {
    expect(
      hasSupabaseSessionCookie(["sb-mxjfxkkypbnrelhfplii-auth-token-code-verifier"])
    ).toBe(false)
  })

  it.each([[[]], [["theme", "sidebar_state"]], [["sb-auth-token"]], [["auth-token"]]])(
    "reports no session for unrelated cookies: %j",
    (names: string[]) => {
      expect(hasSupabaseSessionCookie(names)).toBe(false)
    }
  )
})
