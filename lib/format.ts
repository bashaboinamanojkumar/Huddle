import { availabilityMeta, categoryMeta } from "@/lib/data/seed"
import type { AvailabilityBlock, Category } from "@/lib/types/huddle"

export function getCategoryMeta(category: Category) {
  return categoryMeta.find((item) => item.id === category) ?? categoryMeta[0]
}

export function getAvailabilityMeta(block: AvailabilityBlock) {
  return availabilityMeta.find((item) => item.id === block) ?? availabilityMeta[0]
}

export function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

export function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
