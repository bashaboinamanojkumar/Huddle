"use client"

import { Phone } from "lucide-react"
import Link from "next/link"

export function CrisisBanner() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-dark-navy py-2 px-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <p className="text-xs text-white/80">
          Need immediate help? Call <span className="font-semibold text-white">988</span> or Text{" "}
          <span className="font-semibold text-white">HOME to 741741</span>
        </p>
        <Link
          href="/crisis"
          className="flex items-center gap-1.5 rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-coral/90"
        >
          <Phone className="h-3 w-3" />
          Get Help Now
        </Link>
      </div>
    </div>
  )
}
