"use client"

import { motion } from "framer-motion"
import { Sparkles, Network, TrendingUp } from "lucide-react"

const steps = [
  {
    icon: Sparkles,
    title: "Create Your Profile",
    description: "Tell us about yourself, your interests, and what kind of support you're looking for.",
  },
  {
    icon: Network,
    title: "Find Your People",
    description: "Match with peers who understand, join communities, and attend events.",
  },
  {
    icon: TrendingUp,
    title: "Grow Together",
    description: "Track your wellness, earn achievements, and build lasting support networks.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-card py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center font-heading text-3xl font-bold text-navy md:text-4xl"
        >
          Your Journey to Connection
        </motion.h2>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="relative flex flex-col items-center text-center"
            >
              {i < 2 && (
                <div className="absolute right-0 top-10 hidden w-full translate-x-1/2 border-t-2 border-dashed border-secondary/30 md:block" />
              )}
              <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary/10">
                <step.icon className="h-9 w-9 text-secondary" />
              </div>
              <h3 className="mt-6 font-heading text-lg font-semibold text-navy">{step.title}</h3>
              <p className="mt-2 max-w-xs leading-relaxed text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
