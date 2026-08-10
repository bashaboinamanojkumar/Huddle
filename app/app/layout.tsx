"use client"

import { BottomNav } from "@/components/app/bottom-nav"
import { PhoneFrame } from "@/components/layout/phone-frame"
import { SessionGuard } from "@/components/auth/session-guard"
import { NotificationProvider } from "@/lib/notifications/notification-provider"

import { PromptCoordinator } from "@/components/pwa/prompt-coordinator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneFrame>
      <SessionGuard>
        <NotificationProvider>
          <main className="authenticated-main min-h-0 flex-1 overflow-y-auto pb-24">
            {children}
          </main>
          <div className="shrink-0">
            <BottomNav />
          </div>
          <PromptCoordinator />
        </NotificationProvider>
      </SessionGuard>
    </PhoneFrame>
  )
}
