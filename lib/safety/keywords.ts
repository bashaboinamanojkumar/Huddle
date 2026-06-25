const flaggedTerms = [
  "private residence",
  "dorm room only",
  "bring alcohol",
  "substances",
  "no one can know",
  "send nudes",
  "self harm",
  "kill myself",
  "hurt someone",
]

export function flagMessage(body: string): { flagged: boolean; reason?: string } {
  const normalized = body.toLowerCase()
  const match = flaggedTerms.find((term) => normalized.includes(term))

  if (!match) {
    return { flagged: false }
  }

  return {
    flagged: true,
    reason: `Matched safety keyword: ${match}`,
  }
}
