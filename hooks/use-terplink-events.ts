import { useEffect, useState } from "react"
import type { HuddleActivity } from "@/lib/types/huddle"

export function useTerplinkEvents() {
  const [events, setEvents] = useState<HuddleActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/terplink")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { events, loading }
}