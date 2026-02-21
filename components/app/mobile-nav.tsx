"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Users, Plus, MessageCircle, User, AlertTriangle } from "lucide-react"

const tabs = [
  { href: "/app", icon: Home, label: "Home" },
  { href: "/app/communities", icon: Users, label: "Spaces" },
  { href: "/app/mood", icon: Plus, label: "Check-In", isCenter: true },
  { href: "/app/messages", icon: MessageCircle, label: "Messages" },
  { href: "/app/profile", icon: User, label: "Profile" },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Crisis floating button */}
      <Link
        href="/crisis"
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-coral text-white shadow-lg lg:hidden"
        aria-label="Crisis support"
      >
        <AlertTriangle className="h-5 w-5" />
      </Link>

      {/* Tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:hidden">
        <nav className="mx-auto flex max-w-md items-end justify-around px-2 pb-2 pt-1">
          {tabs.map((tab) => {
            const isActive = tab.href === "/app" ? pathname === "/app" : pathname.startsWith(tab.href)
            if (tab.isCenter) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex -translate-y-3 flex-col items-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-coral text-white shadow-lg">
                    <tab.icon className="h-6 w-6" />
                  </div>
                  <span className="mt-0.5 text-[10px] text-coral">{tab.label}</span>
                </Link>
              )
            }
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center py-1 ${
                  isActive ? "text-secondary" : "text-muted-foreground"
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="mt-0.5 text-[10px]">{tab.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
