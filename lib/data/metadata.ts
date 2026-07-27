import type { AvailabilityMeta, CategoryMeta } from "@/lib/types/huddle"

// Presentation metadata for the category and availability enums. The enums themselves are
// defined in Postgres; this only supplies labels, icons and colours for the UI.
export const categoryMeta: CategoryMeta[] = [
  { id: "study", label: "Study / Academics", shortLabel: "Study", icon: "BookOpen", color: "#8bb7ff" },
  { id: "coffee", label: "Coffee & Food", shortLabel: "Coffee", icon: "Coffee", color: "#f0b889" },
  { id: "outdoors", label: "Outdoors & Walks", shortLabel: "Walks", icon: "Trees", color: "#8fe3b0" },
  { id: "fitness", label: "Fitness & Sports", shortLabel: "Fitness", icon: "Dumbbell", color: "#ff8f8f" },
  { id: "games", label: "Games (board/video)", shortLabel: "Games", icon: "Gamepad2", color: "#c8a4ff" },
  { id: "arts", label: "Arts & Music", shortLabel: "Arts", icon: "Music", color: "#ff9ed1" },
  { id: "faith", label: "Faith & Spirituality", shortLabel: "Faith", icon: "Sparkles", color: "#f4d06f" },
  { id: "language", label: "Language Exchange", shortLabel: "Language", icon: "Languages", color: "#82d7ff" },
  { id: "volunteering", label: "Volunteering", shortLabel: "Service", icon: "HeartHandshake", color: "#7dd9c5" },
  { id: "hangout", label: "Just hang out", shortLabel: "Hangout", icon: "Smile", color: "#d7deff" },
  { id: "sports", label: "Sports", shortLabel: "Sports", icon: "Trophy", color: "#ffd580" },
]

export const availabilityMeta: AvailabilityMeta[] = [
  { id: "weekday_morning", label: "Weekday morning", shortLabel: "Weekday AM" },
  { id: "weekday_afternoon", label: "Weekday afternoon", shortLabel: "Weekday PM" },
  { id: "weekday_evening", label: "Weekday evening", shortLabel: "Weeknight" },
  { id: "weekend_morning", label: "Weekend morning", shortLabel: "Weekend AM" },
  { id: "weekend_afternoon", label: "Weekend afternoon", shortLabel: "Weekend PM" },
  { id: "weekend_evening", label: "Weekend evening", shortLabel: "Weekend night" },
]
