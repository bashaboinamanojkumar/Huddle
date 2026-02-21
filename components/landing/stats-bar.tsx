"use client"

import { motion } from "framer-motion"
import { Users, Heart, Globe, Clock } from "lucide-react"
import { useEffect, useRef, useState } from "react"

function AnimatedCounter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const duration = 2000
    const steps = 60
    const increment = end / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [isVisible, end])

  return (
    <span ref={ref} className="font-heading text-3xl font-bold text-navy md:text-4xl">
      {count.toLocaleString()}{suffix}
    </span>
  )
}

const stats = [
  { icon: Users, value: 2400, suffix: "+", label: "Students Connected" },
  { icon: Heart, value: 98, suffix: "%", label: "Feel Less Alone" },
  { icon: Globe, value: 50, suffix: "+", label: "Support Communities" },
  { icon: Clock, value: 24, suffix: "/7", label: "Available" },
]

export function StatsBar() {
  return (
    <section id="stats" className="bg-secondary/10 py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col items-center gap-2 text-center"
          >
            <stat.icon className="h-8 w-8 text-secondary" />
            <AnimatedCounter end={stat.value} suffix={stat.suffix} />
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
