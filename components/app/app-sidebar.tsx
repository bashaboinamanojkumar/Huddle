"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HuddleLogo } from "@/components/huddle-logo"
import {
  Home, Users, MessageCircle, Handshake, BookOpen, Calendar, Trophy,
  User, Settings, AlertTriangle, Flame,
} from "lucide-react"

const navItems = [
  { href: "/app", icon: Home, label: "Home" },
  { href: "/app/communities", icon: Users, label: "My Communities" },
  { href: "/app/messages", icon: MessageCircle, label: "Messages" },
  { href: "/app/matching", icon: Handshake, label: "Peer Matches" },
  { href: "/app/resources", icon: BookOpen, label: "Resources" },
  { href: "/app/events", icon: Calendar, label: "Events" },
  { href: "/app/achievements", icon: Trophy, label: "Achievements" },
  { href: "/app/profile", icon: User, label: "My Profile" },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5">
        <HuddleLogo size={28} />
        <span className="font-heading text-lg font-bold text-sidebar-foreground">Huddle</span>
      </div>

      {/* User Info */}
      <div className="mx-4 flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">
          A
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-sidebar-foreground">Alex T.</p>
          <p className="text-xs text-sidebar-foreground/60">Feeling Good</p>
        </div>
      </div>

      {/* Streak */}
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-sidebar-accent p-3">
        <Flame className="h-5 w-5 text-coral" />
        <span className="text-sm font-medium text-sidebar-foreground">7 Day Streak</span>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex-1 px-3">
        {navItems.map((item) => {
          const isActive = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-l-2 border-secondary bg-sidebar-accent font-semibold text-secondary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto px-3 pb-4">
        <Link
          href="/app/settings"
          className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        <Link
          href="/crisis"
          className="flex items-center gap-3 rounded-xl bg-coral/20 px-3 py-2.5 text-sm font-semibold text-coral transition-colors hover:bg-coral/30"
        >
          <AlertTriangle className="h-5 w-5" />
          Crisis Support
        </Link>
      </div>
    </aside>
  )
}
