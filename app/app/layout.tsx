"use client"

import { BottomNav } from "@/components/app/bottom-nav"
import { AppHeader } from "@/components/app/app-header"
import { PhoneFrame } from "@/components/layout/phone-frame"
import { SessionGuard } from "@/components/auth/session-guard"
import { NotificationProvider } from "@/lib/notifications/notification-provider"

import { IosInstallBanner } from "@/components/app/ios-install-banner"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneFrame>
      <SessionGuard>
        <NotificationProvider>
          <AppHeader />
          <main className="min-h-0 flex-1 overflow-y-auto pb-20">
            {children}
          </main>
          <div className="shrink-0">
            <BottomNav />
          </div>
          <IosInstallBanner />
        </NotificationProvider>
      </SessionGuard>
    </PhoneFrame>
  )
}
