import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("phone frame viewport sizing", () => {
  it("uses dynamic viewport classes with fallbacks and desktop spacing", () => {
    const frameSource = readFileSync(
      resolve(process.cwd(), "components/layout/phone-frame.tsx"),
      "utf8",
    )
    const globalStyles = readFileSync(
      resolve(process.cwd(), "app/globals.css"),
      "utf8",
    ).replace(/\s+/g, " ")

    expect(frameSource).toContain("phone-frame-min-height")
    expect(frameSource).toContain("phone-frame-height")
    expect(frameSource).not.toMatch(/\b(?:min-)?h-screen\b/)

    expect(globalStyles).toContain(
      ".phone-frame-min-height { min-height: 100vh; }",
    )
    expect(globalStyles).toContain(".phone-frame-height { height: 100vh; }")
    expect(globalStyles).toContain(
      "@media (min-width: 48rem) { .phone-frame-height { height: calc(100vh - 3rem); } }",
    )
    expect(globalStyles).toContain(
      "@supports (height: 100dvh) { .phone-frame-min-height { min-height: 100dvh; } .phone-frame-height { height: 100dvh; } @media (min-width: 48rem) { .phone-frame-height { height: calc(100dvh - 3rem); } } }",
    )
  })
})
