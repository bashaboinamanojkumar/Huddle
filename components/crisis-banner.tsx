"use client"

import { ShieldAlert } from "lucide-react"
import Link from "next/link"

export function CrisisBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-coral/20 bg-black/85 px-4 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <p className="text-xs leading-5 text-white/70">
          Need immediate help? Call <span className="font-semibold text-white">911</span> or{" "}
          <span className="font-semibold text-white">988</span>.
        </p>
        <Link
          href="/crisis"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-coral px-3 py-2 text-xs font-bold text-white"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Safety
        </Link>
      </div>
    </div>
  )
}
