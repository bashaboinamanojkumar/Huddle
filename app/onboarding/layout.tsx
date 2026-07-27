"use client"

import { SessionGuard } from "@/components/auth/session-guard"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <SessionGuard>{children}</SessionGuard>
}
