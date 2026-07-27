import { describe, expect, it, vi } from "vitest"
import { signOutEverywhere } from "@/lib/auth/sign-out"

describe("dual sign-out", () => {
  it("invalidates Supabase before clearing the local association", async () => {
    const order: string[] = []
    const result = await signOutEverywhere({
      signOutSupabase: vi.fn(async () => {
        order.push("supabase")
        return { error: null }
      }),
      clearLocalSession: vi.fn(() => order.push("local")),
      purgeProtectedCache: vi.fn(() => order.push("cache")),
    })

    expect(result).toEqual({ error: null })
    expect(order).toEqual(["supabase", "local", "cache"])
  })

  it("does not claim local success when Supabase sign-out fails", async () => {
    const providerError = new Error("provider unavailable")
    const clearLocalSession = vi.fn()
    const result = await signOutEverywhere({
      signOutSupabase: vi.fn().mockResolvedValue({ error: providerError }),
      clearLocalSession,
      purgeProtectedCache: vi.fn(),
    })

    expect(result).toEqual({ error: providerError })
    expect(clearLocalSession).not.toHaveBeenCalled()
  })

  it("normalizes a thrown provider failure", async () => {
    const clearLocalSession = vi.fn()
    const result = await signOutEverywhere({
      signOutSupabase: vi.fn().mockRejectedValue("offline"),
      clearLocalSession,
      purgeProtectedCache: vi.fn(),
    })

    expect(result.error).toBeInstanceOf(Error)
    expect(clearLocalSession).not.toHaveBeenCalled()
  })
})
