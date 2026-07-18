"use client"

import { BottomNav } from "@/components/app/bottom-nav"
import { PhoneFrame } from "@/components/layout/phone-frame"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneFrame>
      <main className="min-h-0 flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <div className="shrink-0">
        <BottomNav />
      </div>
    </PhoneFrame>
  )
}