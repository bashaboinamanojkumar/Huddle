import { describe, expect, it } from "vitest"
import { isSafetyOwner } from "@/lib/auth/admin"

describe("administrator authorization", () => {
  it("accepts only the exact server-controlled app metadata role", () => {
    expect(isSafetyOwner({ role: "safety_owner" })).toBe(true)
  })

  it.each([
    undefined,
    null,
    {},
    { role: "admin" },
    { role: "Safety_Owner" },
    { role: ["safety_owner"] },
  ])("rejects non-owner metadata: %s", (metadata) => {
    expect(isSafetyOwner(metadata)).toBe(false)
  })
})
