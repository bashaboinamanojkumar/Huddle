import { describe, expect, it } from "vitest"
import {
  createDiagnosticBuffer,
  resolveDiagnosticPreference,
} from "@/lib/debug/app-diagnostics"

describe("viewport diagnostics", () => {
  it("uses explicit URL switches and otherwise preserves the stored preference", () => {
    expect(resolveDiagnosticPreference("?viewportDebug=1", false)).toEqual({
      enabled: true,
      persistence: "enable",
    })
    expect(resolveDiagnosticPreference("?viewportDebug=0", true)).toEqual({
      enabled: false,
      persistence: "disable",
    })
    expect(resolveDiagnosticPreference("?other=value", true)).toEqual({
      enabled: true,
      persistence: "unchanged",
    })
  })

  it("retains only the newest entries", () => {
    const buffer = createDiagnosticBuffer(2)
    buffer.push({ event: "first", timestamp: "1", data: {} })
    buffer.push({ event: "second", timestamp: "2", data: {} })
    buffer.push({ event: "third", timestamp: "3", data: {} })

    expect(buffer.read().map((entry) => entry.event)).toEqual(["second", "third"])
  })
})
