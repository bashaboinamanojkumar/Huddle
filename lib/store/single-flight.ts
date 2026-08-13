export interface SingleFlight<T> {
  run(operation: () => Promise<T>): Promise<T>
  reset(): void
}

export interface RefreshScope {
  userId: string
  generation: number
}

export function isRefreshScopeCurrent(
  request: RefreshScope,
  currentUserId: string | null,
  currentGeneration: number,
): boolean {
  return request.userId === currentUserId
    && request.generation === currentGeneration
}

export function createSingleFlight<T>(): SingleFlight<T> {
  let current: Promise<T> | undefined

  return {
    run(operation) {
      if (current) {
        return current
      }

      const request = operation()
      const tracked = request.finally(() => {
        if (current === tracked) {
          current = undefined
        }
      })
      current = tracked
      return tracked
    },
    reset() {
      current = undefined
    },
  }
}
