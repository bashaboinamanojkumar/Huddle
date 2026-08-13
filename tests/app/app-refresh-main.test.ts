import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("authenticated app refresh shell", () => {
  it("owns the authenticated scroller without reloading the document", () => {
    const componentPath = resolve(
      process.cwd(),
      "components/app/app-refresh-main.tsx",
    )
    const layoutSource = readFileSync(
      resolve(process.cwd(), "app/app/layout.tsx"),
      "utf8",
    )

    expect(existsSync(componentPath)).toBe(true)
    const componentSource = readFileSync(componentPath, "utf8")
    expect(layoutSource).toContain("<AppRefreshMain>")
    expect(layoutSource).not.toContain("<main className=")
    expect(componentSource).toContain("authenticated-main")
    expect(componentSource).toContain('addEventListener("touchmove"')
    expect(componentSource).toContain("passive: false")
    expect(componentSource).toContain('addEventListener("visibilitychange"')
    expect(componentSource).toContain('addEventListener("pageshow"')
    expect(componentSource).toContain('addEventListener("online"')
    expect(componentSource).toContain('aria-label="Refresh content"')
    expect(componentSource).toContain("[contenteditable]:not([contenteditable='false'])")
    expect(componentSource).toContain("pull-to-refresh-spinner")
    expect(componentSource).toContain('recordAppDiagnostic("pull:start"')
    expect(componentSource).toContain('recordAppDiagnostic("refresh:manual-start"')
    expect(componentSource).toContain('recordAppDiagnostic("refresh:auto-start"')
    expect(componentSource).not.toContain("location.reload")
    expect(componentSource).not.toContain("router.refresh")
  })
})
