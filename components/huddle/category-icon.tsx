import {
  BookOpen,
  Coffee,
  Dumbbell,
  Gamepad2,
  HeartHandshake,
  Languages,
  Music,
  Smile,
  Sparkles,
  Trees,
} from "lucide-react"
import type { Category } from "@/lib/types/huddle"

const iconMap = {
  study: BookOpen,
  coffee: Coffee,
  outdoors: Trees,
  fitness: Dumbbell,
  games: Gamepad2,
  arts: Music,
  faith: Sparkles,
  language: Languages,
  volunteering: HeartHandshake,
  hangout: Smile,
} satisfies Record<Category, typeof BookOpen>

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = iconMap[category]
  return <Icon className={className} />
}
