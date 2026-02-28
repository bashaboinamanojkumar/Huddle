"use client"

import { motion } from "framer-motion"
import { Shield, BookOpen, Users } from "lucide-react"
import Link from "next/link"
import { HuddleLogoFull } from "@/components/huddle-logo"

export function PartnershipSection() {
  return (
    <section className="bg-card py-20">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 text-center">
        <div className="flex items-center gap-6">
          <HuddleLogoFull />
          <span className="text-2xl text-muted-foreground">+</span>
          <span className="font-heading text-xl font-bold text-navy">UMD</span>
        </div>
        <p className="text-lg text-muted-foreground">
          Partnered with UMD Counseling Center and Student Affairs
        </p>
        <div className="flex flex-wrap justify-center gap-6">
          {[
            { icon: Shield, label: "HIPAA-Aware Design" },
            { icon: BookOpen, label: "Peer-Reviewed" },
            { icon: Users, label: "Student-Led" },
          ].map((badge) => (
            <div
              key={badge.label}
              className="flex items-center gap-2 rounded-full bg-secondary/10 px-5 py-2.5 text-sm font-medium text-navy"
            >
              <badge.icon className="h-4 w-4 text-secondary" />
              {badge.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCTA() {
  return (
    <section className="bg-gradient-to-r from-navy to-secondary py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-heading text-3xl font-bold text-white md:text-4xl"
        >
          Ready to Find Your People?
        </motion.h2>
        <p className="mt-4 text-lg text-white/70">
          Join thousands of UMD students already supporting each other.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-full bg-coral px-10 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-coral/90 hover:shadow-xl"
        >
          Get Started Free
        </Link>
        <p className="mt-4 text-sm text-white/50">
          Takes 3 minutes - No credit card - UMD email required
        </p>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="bg-dark-navy pb-16 pt-16">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-4">
        <div>
          <HuddleLogoFull className="text-white" />
          <p className="mt-3 text-sm text-white/50">Connect. Share. Heal Together.</p>
        </div>
        <div>
          <h4 className="font-heading text-sm font-semibold text-white">Platform</h4>
          <nav className="mt-4 flex flex-col gap-2">
            {["Home", "Communities", "Events", "Resources"].map((link) => (
              <Link key={link} href="/app" className="text-sm text-white/50 transition-colors hover:text-white">
                {link}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <h4 className="font-heading text-sm font-semibold text-white">Support</h4>
          <nav className="mt-4 flex flex-col gap-2">
            {["Crisis Hotline", "UMD Counseling", "FAQ", "Contact Us"].map((link) => (
              <Link key={link} href="/crisis" className="text-sm text-white/50 transition-colors hover:text-white">
                {link}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <h4 className="font-heading text-sm font-semibold text-white">Legal</h4>
          <nav className="mt-4 flex flex-col gap-2">
            {["Privacy Policy", "Terms of Service", "Community Guidelines", "Accessibility"].map((link) => (
              <Link key={link} href="#" className="text-sm text-white/50 transition-colors hover:text-white">
                {link}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-white/10 px-6 pt-6">
        <p className="text-center text-sm text-coral">
          Crisis Line: 988 | UMD Counseling: 301-314-7651
        </p>
      </div>
    </footer>
  )
}
