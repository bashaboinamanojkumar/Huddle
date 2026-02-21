"use client"

import { useEffect, useState } from "react"
import { HudrdleLogoFull } from "@/components/hudrdle-logo"
import Link from "next/link"

const quotes = [
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { text: "You don't have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
  { text: "There is hope, even when your brain tells you there isn't.", author: "John Green" },
  { text: "You are not your illness. You have an individual story to tell.", author: "Julian Seifter" },
]

export function AuthLayout({
  children,
  footerLink,
  footerText,
}: {
  children: React.ReactNode
  footerLink: { href: string; label: string }
  footerText: string
}) {
  const [quoteIndex, setQuoteIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden w-[40%] flex-col justify-between bg-navy p-10 lg:flex">
        <HudrdleLogoFull className="text-white" />
        <div className="space-y-6">
          <blockquote className="text-xl leading-relaxed text-white/80" style={{ fontFamily: "var(--font-lora)", fontStyle: "italic" }}>
            {'"'}{quotes[quoteIndex].text}{'"'}
          </blockquote>
          <p className="text-sm text-white/50">— {quotes[quoteIndex].author}</p>
          {/* Network Visualization */}
          <div className="mt-8 flex items-center gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="relative">
                <div
                  className="h-10 w-10 rounded-full"
                  style={{
                    backgroundColor: ["#4A9FD4", "#B8A9E3", "#4ECDC4", "#87CEEB", "#FF6B6B"][i],
                    opacity: 0.8,
                  }}
                />
                {i < 4 && (
                  <div className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 translate-x-full bg-white/20" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <Link href={footerLink.href} className="text-sm text-white/60 transition-colors hover:text-white">
            {footerText} <span className="text-secondary">{footerLink.label}</span>
          </Link>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
        {/* Crisis Banner */}
        <div className="border-t border-coral/20 bg-coral/5 px-6 py-3 text-center">
          <p className="text-sm text-coral">
            If you{"'"}re in crisis right now, please call <strong>988</strong> or text <strong>HOME to 741741</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
