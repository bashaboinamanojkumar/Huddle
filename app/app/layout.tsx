"use client"

import { BottomNav } from "@/components/app/bottom-nav"
import { PhoneFrame } from "@/components/layout/phone-frame"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneFrame>
      <main className="min-h-0 flex-1 overflow-y-auto pb-3">
        {children}
      </main>
      <BottomNav />
    </PhoneFrame>
  )
}
