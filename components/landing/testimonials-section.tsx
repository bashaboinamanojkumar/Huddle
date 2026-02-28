"use client"

import { motion } from "framer-motion"
import { Star } from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

const testimonials = [
  {
    quote: "Huddle helped me find people who actually understand what I'm going through. It changed my college experience.",
    name: "Sarah M.",
    info: "UMD Junior, Psychology",
    color: "bg-lavender/30",
    anonymous: false,
  },
  {
    quote: "The anonymous mode gave me the courage to finally talk about my anxiety. I realized I wasn't alone.",
    name: "Anonymous",
    info: "UMD Sophomore",
    color: "bg-secondary/20",
    anonymous: true,
  },
  {
    quote: "I came to support others and ended up finding my own support system. Best community I've joined at UMD.",
    name: "Marcus T.",
    info: "UMD Senior, Computer Science",
    color: "bg-sky/30",
    anonymous: false,
  },
  {
    quote: "The mood tracker helped me notice patterns I never saw before. Now I take better care of myself during exam weeks.",
    name: "Anonymous",
    info: "UMD Junior",
    color: "bg-lavender/30",
    anonymous: true,
  },
  {
    quote: "As an international student, finding Huddle was like finding a second family. The community here is incredible.",
    name: "Priya K.",
    info: "UMD Grad Student, Engineering",
    color: "bg-secondary/20",
    anonymous: false,
  },
]

export function TestimonialsSection() {
  return (
    <section className="bg-soft-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center font-heading text-3xl font-bold text-navy md:text-4xl"
        >
          Real Stories from UMD Students
        </motion.h2>
        <ScrollArea className="mt-12 w-full">
          <div className="flex gap-6 pb-4">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`min-w-[300px] max-w-[340px] flex-shrink-0 rounded-2xl ${t.color} p-6`}
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-coral text-coral" />
                  ))}
                </div>
                <p className="mt-4 leading-relaxed text-navy" style={{ fontFamily: "var(--font-lora)" }}>
                  {'"'}{t.quote}{'"'}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: t.anonymous ? "#6B7280" : "#4A9FD4" }}
                  >
                    {t.anonymous ? "?" : t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.info}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </section>
  )
}
