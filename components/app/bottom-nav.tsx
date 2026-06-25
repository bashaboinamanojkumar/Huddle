"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarHeart, MessageCircle, Plus, Trophy, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/app", label: "Feed", icon: CalendarHeart },
  { href: "/app/community", label: "Community", icon: Trophy },
  { href: "/app/host", label: "Host", icon: Plus, center: true },
  { href: "/app/chats", label: "Chats", icon: MessageCircle },
  { href: "/app/profile", label: "Profile", icon: UserRound },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="safe-pb sticky bottom-0 z-40 border-t border-white/10 bg-black/75 px-3 pt-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-end justify-between">
        {tabs.map((tab) => {
          const active = tab.href === "/app" ? pathname === "/app" : pathname.startsWith(tab.href)
          const Icon = tab.icon

          if (tab.center) {
            return (
              <Link key={tab.href} href={tab.href} className="group -mt-7 flex min-w-14 flex-col items-center gap-1">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg shadow-secondary/30 transition-transform group-hover:scale-105">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-[10px] font-semibold text-secondary">{tab.label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex min-w-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 text-[10px] transition-colors",
                active ? "text-secondary" : "text-white/54 hover:text-white"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-secondary/20")} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
