import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("phone frame viewport sizing", () => {
  it("uses the visual viewport with CSS fallbacks and desktop spacing", () => {
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
    expect(frameSource).toContain("ViewportHeightSync")
    expect(frameSource).not.toMatch(/\b(?:min-)?h-screen\b/)

    expect(globalStyles).toContain(
      ".phone-frame-min-height { min-height: var(--app-viewport-height, 100vh); }",
    )
    expect(globalStyles).toContain(
      ".phone-frame-height { height: var(--app-viewport-height, 100vh); }",
    )
    expect(globalStyles).toContain(
      "@media (min-width: 48rem) { .phone-frame-height { height: calc(var(--app-viewport-height, 100vh) - 3rem); } }",
    )
    expect(globalStyles).toContain(
      "@supports (height: 100dvh) { .phone-frame-min-height { min-height: var(--app-viewport-height, 100dvh); } .phone-frame-height { height: var(--app-viewport-height, 100dvh); } @media (min-width: 48rem) { .phone-frame-height { height: calc(var(--app-viewport-height, 100dvh) - 3rem); } } }",
    )
  })

  it("keeps shared safe padding unchanged and scopes maximum inset handling to BottomNav", () => {
    const navigationSource = readFileSync(
      resolve(process.cwd(), "components/app/bottom-nav.tsx"),
      "utf8",
    )
    const globalStyles = readFileSync(
      resolve(process.cwd(), "app/globals.css"),
      "utf8",
    ).replace(/\s+/g, " ")

    expect(navigationSource).toContain(
      'className="bottom-nav-safe-area sticky bottom-0',
    )
    expect(navigationSource).toContain(
      'className="bottom-nav-safe-area-content mx-auto',
    )
    expect(navigationSource).not.toMatch(/<nav className="[^"]*\bsafe-pb\b/u)
    expect(globalStyles).toContain(
      ".safe-pb { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }",
    )
    expect(globalStyles).toContain(
      ".bottom-nav-safe-area { --bottom-nav-current-inset: env(safe-area-inset-bottom, 0px); --bottom-nav-maximum-inset: env( safe-area-max-inset-bottom, var(--bottom-nav-current-inset) ); padding-bottom: max(1rem, var(--bottom-nav-maximum-inset)); }",
    )
    expect(globalStyles).toContain(
      ".bottom-nav-safe-area-content { transform: translateY( calc(var(--bottom-nav-maximum-inset) - var(--bottom-nav-current-inset)) ); }",
    )
  })
})
