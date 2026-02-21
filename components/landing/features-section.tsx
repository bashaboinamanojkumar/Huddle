"use client"

import { motion } from "framer-motion"
import { Users, Shield, BarChart3, AlertTriangle, EyeOff, Calendar } from "lucide-react"

const features = [
  {
    icon: Users,
    title: "Peer Matching",
    description: "Smart algorithm connects you with compatible students who understand your experience.",
  },
  {
    icon: Shield,
    title: "Safe Communities",
    description: "Moderated spaces for every experience, identity, and interest. Always respectful.",
  },
  {
    icon: BarChart3,
    title: "Mood Tracking",
    description: "Daily check-ins with insights over time to help you understand your patterns.",
  },
  {
    icon: AlertTriangle,
    title: "Crisis Support",
    description: "Immediate resources always one tap away. You're never alone in tough moments.",
  },
  {
    icon: EyeOff,
    title: "Anonymous Mode",
    description: "Share freely without revealing your identity. Your privacy is our priority.",
  },
  {
    icon: Calendar,
    title: "Events & Workshops",
    description: "Live sessions with counselors and peers. Learn, grow, and connect together.",
  },
]

export function FeaturesSection() {
  return (
    <section className="bg-navy py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center font-heading text-3xl font-bold text-white md:text-4xl"
        >
          Everything You Need in One Place
        </motion.h2>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:bg-white/10"
            >
              <feature.icon className="h-8 w-8 text-secondary" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 leading-relaxed text-white/60">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
