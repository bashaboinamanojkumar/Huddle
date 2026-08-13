"use client"

import { BottomNav } from "@/components/app/bottom-nav"
import { AppRefreshMain } from "@/components/app/app-refresh-main"
import { PhoneFrame } from "@/components/layout/phone-frame"
import { AppViewportController } from "@/components/layout/app-viewport-controller"
import { SessionGuard } from "@/components/auth/session-guard"
import { NotificationProvider } from "@/lib/notifications/notification-provider"

import { PromptCoordinator } from "@/components/pwa/prompt-coordinator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneFrame>
      <AppViewportController />
      <SessionGuard>
        <NotificationProvider>
          <AppRefreshMain>
            {children}
          </AppRefreshMain>
          <div className="shrink-0">
            <BottomNav />
          </div>
          <PromptCoordinator />
        </NotificationProvider>
      </SessionGuard>
    </PhoneFrame>
  )
}
