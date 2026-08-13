import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ViewportDebugPanel } from "@/components/layout/viewport-debug-panel"

describe("ViewportDebugPanel", () => {
  it("renders a collapsed phone-readable diagnostics control", () => {
    const html = renderToStaticMarkup(
      <ViewportDebugPanel onDisable={() => undefined} />,
    )

    expect(html).toContain("Open viewport diagnostics")
    expect(html).toContain("Viewport debug")
    expect(html).not.toContain("Copy JSON")
  })

  it("is mounted only by the viewport controller", () => {
    const controllerSource = readFileSync(
      resolve(process.cwd(), "components/layout/app-viewport-controller.tsx"),
      "utf8",
    )

    expect(controllerSource).toContain("initializeAppDiagnostics")
    expect(controllerSource).toContain("recordAppDiagnostic")
    expect(controllerSource).toContain("<ViewportDebugPanel")
  })
})
