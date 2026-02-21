"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Phone, MessageCircle, Building2, ArrowLeft, Heart, Shield, ChevronDown, ChevronUp, Send, ExternalLink } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { HudrdleLogo } from "@/components/hudrdle-logo"

const safetyPlanSteps = [
  { question: "What are my warning signs?", placeholder: "e.g., Feeling isolated, not sleeping, skipping meals..." },
  { question: "Who can I call?", placeholder: "e.g., Mom (555-0123), Best friend Jamie, Roommate..." },
  { question: "What makes me feel better?", placeholder: "e.g., Listening to music, going for a walk, talking to someone..." },
  { question: "Places I can go", placeholder: "e.g., Library, friend's room, campus health center..." },
]

export default function CrisisPage() {
  const [breatheActive, setBreatheActive] = useState(false)
  const [breathePhase, setBreathePhase] = useState("idle")
  const [safetyPlanOpen, setSafetyPlanOpen] = useState(false)
  const [safetyPlanAnswers, setSafetyPlanAnswers] = useState<string[]>(["", "", "", ""])
  const [peerRequestSent, setPeerRequestSent] = useState(false)

  const startBreathing = () => {
    setBreatheActive(true)
    const phases = ["Breathe In", "Hold", "Breathe Out"]
    const durations = [4000, 7000, 8000]
    let index = 0

    const runCycle = () => {
      if (index >= phases.length) index = 0
      setBreathePhase(phases[index])
      const timeout = setTimeout(() => {
        index++
        if (index < phases.length * 3) runCycle()
        else {
          setBreatheActive(false)
          setBreathePhase("idle")
        }
      }, durations[index % durations.length])
      return timeout
    }

    runCycle()
  }

  const updateSafetyPlan = (index: number, value: string) => {
    setSafetyPlanAnswers(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  return (
    <div className="min-h-screen bg-navy">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <Link href="/app" className="flex items-center gap-2 text-white/70 transition-colors hover:text-white">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back to App</span>
        </Link>
        <HudrdleLogo size={24} />
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 md:px-8">
        {/* Main Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Heart className="mx-auto h-10 w-10 text-mint" />
          <h1 className="mt-4 font-heading text-3xl font-bold text-white md:text-4xl">
            {"You're"} Not Alone. Help Is Here.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-white/60">
            Whatever {"you're"} going through, there are people who care and want to help. Reaching out is a sign of strength.
          </p>
        </motion.div>

        {/* Immediate Help Cards */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <motion.a
            href="tel:988"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="group flex flex-col items-center rounded-2xl bg-white/10 p-6 text-center backdrop-blur-sm transition-colors hover:bg-white/15"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-coral/20">
              <Phone className="h-7 w-7 text-coral" />
            </div>
            <h2 className="mt-3 font-heading text-lg font-bold text-white">Call 988</h2>
            <p className="mt-1 text-sm text-white/60">Suicide & Crisis Lifeline</p>
            <p className="mt-1 text-xs text-mint">Available 24/7</p>
            <span className="mt-3 rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-coral/80">
              Call Now
            </span>
          </motion.a>

          <motion.a
            href="sms:741741?body=HOME"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="group flex flex-col items-center rounded-2xl bg-white/10 p-6 text-center backdrop-blur-sm transition-colors hover:bg-white/15"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/20">
              <MessageCircle className="h-7 w-7 text-secondary" />
            </div>
            <h2 className="mt-3 font-heading text-lg font-bold text-white">Text HOME to 741741</h2>
            <p className="mt-1 text-sm text-white/60">Crisis Text Line</p>
            <p className="mt-1 text-xs text-mint">Confidential</p>
            <span className="mt-3 rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-secondary/80">
              Text Now
            </span>
          </motion.a>

          <motion.a
            href="tel:3013147651"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="group flex flex-col items-center rounded-2xl bg-white/10 p-6 text-center backdrop-blur-sm transition-colors hover:bg-white/15"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mint/20">
              <Building2 className="h-7 w-7 text-mint" />
            </div>
            <h2 className="mt-3 font-heading text-lg font-bold text-white">UMD Counseling</h2>
            <p className="mt-1 text-sm text-white/60">301-314-7651</p>
            <p className="mt-1 text-xs text-white/40">M-F 8:30am - 4:30pm</p>
            <span className="mt-3 rounded-full bg-mint px-5 py-2 text-sm font-semibold text-dark-navy transition-colors group-hover:bg-mint/80">
              Call Now
            </span>
          </motion.a>
        </div>

        {/* UMD-Specific Resources */}
        <div className="mt-8 rounded-2xl bg-white/5 p-6 backdrop-blur-sm">
          <h2 className="font-heading text-lg font-semibold text-white">UMD Campus Resources</h2>
          <div className="mt-4 space-y-3">
            {[
              { name: "CARE to Report a Concern", detail: "care.umd.edu", link: "#" },
              { name: "University Health Center", detail: "301-314-8184", link: "#" },
              { name: "Campus Emergency", detail: "Call 911", link: "tel:911" },
              { name: "UMD Police (non-emergency)", detail: "301-405-3333", link: "tel:3014053333" },
              { name: "Stamp Student Union Resources", detail: "stamp.umd.edu", link: "#" },
            ].map(resource => (
              <a
                key={resource.name}
                href={resource.link}
                className="flex items-center justify-between rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
              >
                <div>
                  <p className="text-sm font-medium text-white">{resource.name}</p>
                  <p className="text-xs text-white/50">{resource.detail}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-white/30" />
              </a>
            ))}
          </div>
        </div>

        {/* Peer Support Request */}
        <div className="mt-8 rounded-2xl bg-secondary/10 p-6 backdrop-blur-sm">
          <h2 className="font-heading text-lg font-semibold text-white">I Need to Talk to Someone</h2>
          <p className="mt-1 text-sm text-white/60">Get connected with a trained peer supporter</p>
          {!peerRequestSent ? (
            <button
              onClick={() => setPeerRequestSent(true)}
              className="mt-4 flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary/80"
            >
              <Send className="h-4 w-4" />
              Connect Now (Anonymous)
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-xl bg-mint/10 p-4"
            >
              <p className="text-sm font-medium text-mint">Request sent. Connecting you now...</p>
              <p className="mt-1 text-xs text-white/50">Estimated wait: under 2 minutes</p>
            </motion.div>
          )}
        </div>

        {/* Breathing Exercise */}
        <div className="mt-8 rounded-2xl bg-white/5 p-6 text-center backdrop-blur-sm">
          <h2 className="font-heading text-lg font-semibold text-white">Need to Calm Down Right Now?</h2>
          <p className="mt-1 text-sm text-white/60">4-7-8 breathing technique</p>
          <div className="mt-6 flex flex-col items-center">
            <motion.div
              animate={{
                scale: breathePhase === "Breathe In" ? 1.5 : breathePhase === "Hold" ? 1.5 : breathePhase === "Breathe Out" ? 1 : 1,
              }}
              transition={{ duration: breathePhase === "Breathe In" ? 4 : breathePhase === "Breathe Out" ? 8 : 0.3 }}
              className="flex h-32 w-32 items-center justify-center rounded-full bg-mint/20"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-mint/30">
                <span className="text-sm font-medium text-mint">
                  {breatheActive ? breathePhase : "Ready"}
                </span>
              </div>
            </motion.div>
            <button
              onClick={() => breatheActive ? setBreatheActive(false) : startBreathing()}
              className="mt-6 rounded-full bg-mint px-6 py-2.5 text-sm font-semibold text-dark-navy transition-colors hover:bg-mint/80"
            >
              {breatheActive ? "Stop" : "Start Breathing Exercise"}
            </button>
          </div>
        </div>

        {/* Safety Planning Tool */}
        <div className="mt-8 rounded-2xl bg-white/5 p-6 backdrop-blur-sm">
          <button
            onClick={() => setSafetyPlanOpen(!safetyPlanOpen)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-lavender" />
              <h2 className="font-heading text-lg font-semibold text-white">My Safety Plan</h2>
            </div>
            {safetyPlanOpen ? (
              <ChevronUp className="h-5 w-5 text-white/50" />
            ) : (
              <ChevronDown className="h-5 w-5 text-white/50" />
            )}
          </button>
          <p className="mt-1 text-sm text-white/50">A personal guide for when things get tough</p>

          <AnimatePresence>
            {safetyPlanOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-4 overflow-hidden"
              >
                {safetyPlanSteps.map((step, i) => (
                  <div key={step.question}>
                    <label className="text-sm font-medium text-white">{step.question}</label>
                    <Textarea
                      value={safetyPlanAnswers[i]}
                      onChange={(e) => updateSafetyPlan(i, e.target.value)}
                      placeholder={step.placeholder}
                      className="mt-1 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30"
                      rows={2}
                    />
                  </div>
                ))}
                <div className="flex gap-3">
                  <button className="rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-white">
                    Save Plan
                  </button>
                  <button className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white/70">
                    Email to Myself
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Reassurance */}
        <div className="mt-12 text-center">
          <p className="text-sm text-white/40">
            This page is always accessible from anywhere in the app.
          </p>
          <p className="mt-1 text-sm text-white/40">
            Your information on this page is private and never shared.
          </p>
        </div>
      </main>
    </div>
  )
}
