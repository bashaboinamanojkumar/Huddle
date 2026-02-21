"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Heart, X, ArrowUp, Undo2, Filter, MessageCircle } from "lucide-react"

const matchCards = [
  {
    id: 1, name: "Jamie K.", year: "Junior", major: "Psychology",
    interests: ["Music", "Meditation", "Hiking"],
    communities: ["Anxiety Allies", "Meditation Circle"],
    score: 92,
    reasons: ["Both navigating academic pressure", "Share interest in music and hiking", "Both seeking peer connection"],
  },
  {
    id: 2, name: "Anonymous Terp", year: "Sophomore", major: "",
    interests: ["Art", "Yoga", "Reading"],
    communities: ["Art Therapy Corner", "Depression Support"],
    score: 87,
    reasons: ["Both interested in creative expression", "Similar support preferences", "Both seeking community"],
  },
  {
    id: 3, name: "Riley P.", year: "Senior", major: "Computer Science",
    interests: ["Coding", "Gaming", "Pets"],
    communities: ["Mindful Gaming", "Engineering Solidarity"],
    score: 84,
    reasons: ["Share a love for coding", "Both enjoy gaming communities", "Similar academic backgrounds"],
  },
  {
    id: 4, name: "Priya K.", year: "Grad Student", major: "Engineering",
    interests: ["Travel", "Photography", "Cooking"],
    communities: ["International Students", "Meditation Circle"],
    score: 79,
    reasons: ["Both value mindfulness", "Shared interest in photography", "Both looking to give and receive support"],
  },
]

export default function MatchingPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState<"left" | "right" | "up" | null>(null)
  const [matched, setMatched] = useState(false)
  const [matchedPerson, setMatchedPerson] = useState("")
  const [history, setHistory] = useState<number[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const currentCard = matchCards[currentIndex]

  const handleAction = (action: "left" | "right" | "up") => {
    if (!currentCard) return
    setDirection(action)
    setHistory((prev) => [...prev, currentIndex])

    if (action === "right" || action === "up") {
      if (Math.random() > 0.5) {
        setMatchedPerson(currentCard.name)
        setMatched(true)
        return
      }
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
      setDirection(null)
    }, 300)
  }

  const handleUndo = () => {
    if (history.length === 0) return
    const lastIndex = history[history.length - 1]
    setHistory((prev) => prev.slice(0, -1))
    setCurrentIndex(lastIndex)
  }

  if (matched) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <h1 className="font-heading text-3xl font-bold text-navy">It{"'"}s a Match!</h1>
          <p className="mt-2 text-muted-foreground">You and {matchedPerson} connected!</p>
          <div className="mt-8 flex justify-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-white">A</div>
            <div className="flex items-center">
              <Heart className="h-8 w-8 fill-coral text-coral" />
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-lavender text-2xl font-bold text-white">
              {matchedPerson.charAt(0)}
            </div>
          </div>
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => { setMatched(false); setCurrentIndex((prev) => prev + 1); setDirection(null) }}
              className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-navy"
            >
              Keep Browsing
            </button>
            <button className="flex items-center gap-2 rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white">
              <MessageCircle className="h-4 w-4" />
              Start Conversation
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  if (currentIndex >= matchCards.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <h2 className="font-heading text-2xl font-bold text-navy">You{"'"}ve seen all matches!</h2>
        <p className="mt-2 text-muted-foreground">Check back later for new peer suggestions.</p>
        <button
          onClick={() => { setCurrentIndex(0); setHistory([]) }}
          className="mt-6 rounded-full bg-secondary px-6 py-2.5 text-sm font-semibold text-white"
        >
          Start Over
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy">Find Your Peer Match</h1>
          <p className="mt-1 text-muted-foreground">Connect with students who truly get it</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <Filter className="h-4 w-4" /> Filters
        </button>
      </div>

      {/* Card */}
      <div className="relative mt-8 flex justify-center" style={{ minHeight: 480 }}>
        <AnimatePresence>
          {currentCard && (
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, x: direction === "left" ? -300 : direction === "right" ? 300 : direction === "up" ? 0 : 0, y: direction === "up" ? -200 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg"
            >
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-lavender text-3xl font-bold text-white">
                  {currentCard.name.charAt(0)}
                </div>
                <h3 className="mt-4 font-heading text-xl font-semibold text-navy">{currentCard.name}</h3>
                {currentCard.major && (
                  <p className="text-sm text-muted-foreground">{currentCard.year} - {currentCard.major}</p>
                )}
              </div>

              {/* Score */}
              <div className="mt-4 flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-mint/10 px-4 py-1.5">
                  <div className="relative h-8 w-8">
                    <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#D1E3F6" strokeWidth="3" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#4ECDC4" strokeWidth="3" strokeDasharray={`${currentCard.score * 0.88} 100`} />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-mint">{currentCard.score}% compatible</span>
                </div>
              </div>

              {/* Interests */}
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Shared Interests</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentCard.interests.map((i) => (
                    <span key={i} className="rounded-full bg-mint/10 px-3 py-1 text-xs font-medium text-mint">{i}</span>
                  ))}
                </div>
              </div>

              {/* Communities */}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Shared Communities</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentCard.communities.map((c) => (
                    <span key={c} className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">{c}</span>
                  ))}
                </div>
              </div>

              {/* Why matched */}
              <div className="mt-5 rounded-xl bg-muted p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Why We Matched You</p>
                <ul className="mt-2 space-y-1">
                  {currentCard.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button onClick={handleUndo} className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted" aria-label="Undo">
          <Undo2 className="h-5 w-5" />
        </button>
        <button onClick={() => handleAction("left")} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-coral/30 text-coral transition-colors hover:bg-coral/5" aria-label="Pass">
          <X className="h-7 w-7" />
        </button>
        <button onClick={() => handleAction("up")} className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-secondary/30 text-secondary transition-colors hover:bg-secondary/5" aria-label="Super connect">
          <ArrowUp className="h-6 w-6" />
        </button>
        <button onClick={() => handleAction("right")} className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white transition-colors hover:bg-dark-navy" aria-label="Connect">
          <Heart className="h-7 w-7" />
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Swipe right to connect - Left to pass - Up for super connect
      </p>
    </div>
  )
}
