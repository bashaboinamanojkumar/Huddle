"use client"

import { BottomNav } from "@/components/app/bottom-nav"
import { PhoneFrame } from "@/components/layout/phone-frame"
import { SessionGuard } from "@/components/auth/session-guard"

import { IosInstallBanner } from "@/components/app/ios-install-banner"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneFrame>
      <main className="min-h-0 flex-1 overflow-y-auto pb-20">
        <SessionGuard>{children}</SessionGuard>
      </main>
      <div className="shrink-0">
        <BottomNav />
      </div>
      <IosInstallBanner />
    </PhoneFrame>
  )
}