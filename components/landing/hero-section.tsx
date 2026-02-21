"use client"

import { motion } from "framer-motion"
import { ArrowDown, MessageCircle, BarChart3, Heart } from "lucide-react"
import Link from "next/link"
import { HudrdleLogoFull } from "@/components/hudrdle-logo"

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-navy to-dark-navy">
      {/* Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-4 md:px-12">
        <HudrdleLogoFull className="text-white" />
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-white/80 transition-colors hover:text-white">
            Log In
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral/90"
          >
            Join Hudrdle
          </Link>
        </div>
      </nav>

      {/* Floating Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />
        <div className="animate-float-delayed absolute right-[15%] top-[30%] h-48 w-48 rounded-full bg-lavender/10 blur-3xl" />
        <div className="animate-float absolute bottom-[20%] left-[30%] h-56 w-56 rounded-full bg-sky/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center px-6 md:px-12 lg:px-20">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2">
          {/* Left - Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="font-heading text-4xl font-bold leading-tight text-white text-balance md:text-5xl lg:text-6xl">
              You Don{"'"}t Have to Navigate College Alone
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
              Hudrdle connects UMD students for real conversations, peer support, and mental
              wellness — built by students, for students.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="rounded-full bg-coral px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-coral/90 hover:shadow-xl"
              >
                Join Hudrdle
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-secondary/50 px-8 py-3.5 text-base font-semibold text-secondary transition-all hover:border-secondary hover:bg-secondary/10"
              >
                See How It Works
              </a>
            </div>
          </motion.div>

          {/* Right - Floating Preview Cards */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative h-[480px]">
              {/* Mood Tracker Card */}
              <div className="animate-float absolute right-0 top-0 w-60 rounded-2xl bg-white/10 p-5 shadow-2xl backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-mint" />
                  <span className="text-sm font-semibold text-white">Mood Tracker</span>
                </div>
                <div className="flex justify-between">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, i) => (
                    <div key={day} className="flex flex-col items-center gap-1">
                      <div
                        className="rounded-full"
                        style={{
                          width: 28,
                          height: 28,
                          backgroundColor: ["#FF6B6B", "#FF6B6B", "#87CEEB", "#4ECDC4", "#4ECDC4"][i],
                        }}
                      />
                      <span className="text-[10px] text-white/60">{day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Card */}
              <div className="animate-float-delayed absolute left-0 top-32 w-64 rounded-2xl bg-white/10 p-5 shadow-2xl backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-secondary" />
                  <span className="text-sm font-semibold text-white">Peer Chat</span>
                </div>
                <div className="space-y-2">
                  <div className="w-3/4 rounded-xl bg-secondary/30 px-3 py-2 text-xs text-white">
                    How are you feeling today?
                  </div>
                  <div className="ml-auto w-3/4 rounded-xl bg-white/20 px-3 py-2 text-xs text-white">
                    Much better, thanks for checking in!
                  </div>
                </div>
              </div>

              {/* Community Card */}
              <div className="animate-float absolute bottom-4 right-8 w-56 rounded-2xl bg-white/10 p-5 shadow-2xl backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Heart className="h-5 w-5 text-coral" />
                  <span className="text-sm font-semibold text-white">Community</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-7 w-7 rounded-full border-2 border-white/20"
                        style={{
                          backgroundColor: ["#4A9FD4", "#B8A9E3", "#4ECDC4", "#87CEEB"][i],
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-white/70">+52 online</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="relative z-10 flex justify-center pb-8">
        <a href="#stats" className="animate-bounce-arrow" aria-label="Scroll down">
          <ArrowDown className="h-6 w-6 text-white/50" />
        </a>
      </div>
    </section>
  )
}
