import type { Category } from "@/lib/types/huddle"
import {
  StudyIcon, CoffeeIcon, WalksIcon, FitnessIcon,
  GamesIcon, ArtsIcon, FaithIcon, LanguageIcon,
  ServiceIcon, HangoutIcon, SportsIcon
} from "@/components/huddle/huddle-icons"

const iconMap = {
  study: StudyIcon,
  coffee: CoffeeIcon,
  outdoors: WalksIcon,
  fitness: FitnessIcon,
  games: GamesIcon,
  arts: ArtsIcon,
  faith: FaithIcon,
  language: LanguageIcon,
  volunteering: ServiceIcon,
  hangout: HangoutIcon,
  sports: SportsIcon,
} satisfies Record<Category, React.ComponentType<{ className?: string }>>

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = iconMap[category]
  return <Icon className={className} />
}