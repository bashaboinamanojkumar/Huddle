import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("Huddle mutation resource budget", () => {
  it("does not invoke generic refresh from mutation callbacks", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/store/huddle-store.tsx"),
      "utf8",
    )
    const mutationSection = source.slice(
      source.indexOf("const completeOnboarding"),
      source.indexOf("const value = useMemo"),
    )
    expect(mutationSection).not.toContain("await refresh()")
  })
})
