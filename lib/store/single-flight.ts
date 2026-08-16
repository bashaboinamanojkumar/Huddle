export interface SingleFlight<T> {
  run(operation: () => Promise<T>): Promise<T>
  reset(): void
}

export interface FeatureFlights<T = unknown> {
  run<TResult extends T>(key: string, operation: () => Promise<TResult>): Promise<TResult>
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

export function createFeatureFlights<T = unknown>(): FeatureFlights<T> {
  const flights = new Map<string, SingleFlight<unknown>>()

  return {
    run<TResult extends T>(key: string, operation: () => Promise<TResult>) {
      let flight = flights.get(key)
      if (!flight) {
        flight = createSingleFlight<unknown>()
        flights.set(key, flight)
      }
      return flight.run(operation) as Promise<TResult>
    },
    reset() {
      for (const flight of flights.values()) {
        flight.reset()
      }
      flights.clear()
    },
  }
}
