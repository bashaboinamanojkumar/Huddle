"use client"

import { AppSidebar } from "@/components/app/app-sidebar"
import { MobileNav } from "@/components/app/mobile-nav"
import { CrisisBanner } from "@/components/crisis-banner"
import { Bell, Search, MessageCircle } from "lucide-react"
import Link from "next/link"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="font-heading text-lg font-bold text-navy">Huddle</span>
          </div>
          <div className="hidden flex-1 lg:block lg:max-w-md">
            <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search communities, people, resources..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-navy" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-[10px] font-bold text-white">3</span>
            </button>
            <Link href="/app/messages" className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-navy" aria-label="Messages">
              <MessageCircle className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-[10px] font-bold text-white">2</span>
            </Link>
            <Link href="/app/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
              A
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
      <CrisisBanner />
    </div>
  )
}
