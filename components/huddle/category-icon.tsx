import type { Category } from "@/lib/types/huddle"

const iconMap: Record<Category, string> = {
  study: "/icons/categories/study.png",
  coffee: "/icons/categories/coffee.png",
  outdoors: "/icons/categories/nature.png",
  fitness: "/icons/categories/fitness.png",
  games: "/icons/categories/games.png",
  arts: "/icons/categories/arts.png",
  faith: "/icons/categories/faith.png",
  language: "/icons/categories/languages.png",
  volunteering: "/icons/categories/service.png",
  hangout: "/icons/categories/hangout.png",
  sports: "/icons/categories/sports.png",
}

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  return (
    <img
      src={iconMap[category]}
      alt={category}
      className={className}
      style={{ mixBlendMode: "screen" }}
    />
  )
}