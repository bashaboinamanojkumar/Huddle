export function isSafetyOwner(appMetadata: unknown): boolean {
  if (!appMetadata || typeof appMetadata !== "object") {
    return false
  }

  return (appMetadata as Record<string, unknown>).role === "safety_owner"
}
