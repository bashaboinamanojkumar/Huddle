import { describe, expect, it, vi } from "vitest"
import {
  createSingleFlight,
  isRefreshScopeCurrent,
} from "@/lib/store/single-flight"

describe("createSingleFlight", () => {
  it("shares one operation between concurrent callers", async () => {
    let resolveOperation: ((value: string) => void) | undefined
    const operation = vi.fn(() => new Promise<string>((resolve) => {
      resolveOperation = resolve
    }))
    const singleFlight = createSingleFlight<string>()

    const first = singleFlight.run(operation)
    const second = singleFlight.run(operation)

    expect(operation).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    resolveOperation?.("fresh")
    await expect(first).resolves.toBe("fresh")
  })

  it("allows a new operation after success or failure", async () => {
    const singleFlight = createSingleFlight<number>()
    await expect(singleFlight.run(async () => 1)).resolves.toBe(1)
    await expect(singleFlight.run(async () => { throw new Error("offline") })).rejects.toThrow("offline")
    await expect(singleFlight.run(async () => 2)).resolves.toBe(2)
  })

  it("can detach an old session without allowing its completion to clear a new request", async () => {
    const resolvers: Array<(value: number) => void> = []
    const operation = () => new Promise<number>((resolve) => resolvers.push(resolve))
    const singleFlight = createSingleFlight<number>()

    const oldSession = singleFlight.run(operation)
    singleFlight.reset()
    const newSession = singleFlight.run(operation)

    resolvers[0](1)
    await expect(oldSession).resolves.toBe(1)
    expect(singleFlight.run(operation)).toBe(newSession)

    resolvers[1](2)
    await expect(newSession).resolves.toBe(2)
  })

  it("rejects results from a cleared or replaced session, including the same user", () => {
    const request = { userId: "student-1", generation: 4 }

    expect(isRefreshScopeCurrent(request, "student-1", 4)).toBe(true)
    expect(isRefreshScopeCurrent(request, null, 5)).toBe(false)
    expect(isRefreshScopeCurrent(request, "student-2", 5)).toBe(false)
    expect(isRefreshScopeCurrent(request, "student-1", 5)).toBe(false)
  })
})
