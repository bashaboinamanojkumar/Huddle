"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { Check, Share2 } from "lucide-react"

const moods = [
  { label: "Struggling", emoji: "\uD83D\uDE1E", color: "#FF6B6B", value: 1 },
  { label: "Low", emoji: "\uD83D\uDE14", color: "#FFB347", value: 2 },
  { label: "Okay", emoji: "\uD83D\uDE10", color: "#87CEEB", value: 3 },
  { label: "Good", emoji: "\uD83D\uDE0A", color: "#4ECDC4", value: 4 },
  { label: "Great", emoji: "\uD83D\uDE04", color: "#4ECDC4", value: 5 },
]

const weekData = [
  { day: "Mon", mood: 3, energy: 5 },
  { day: "Tue", mood: 2, energy: 3 },
  { day: "Wed", mood: 4, energy: 6 },
  { day: "Thu", mood: 3, energy: 4 },
  { day: "Fri", mood: 5, energy: 8 },
  { day: "Sat", mood: 4, energy: 7 },
  { day: "Sun", mood: 4, energy: 6 },
]

const monthData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  mood: Math.max(1, Math.min(5, Math.floor(Math.random() * 3) + 2)),
}))

const suggestions = [
  "Be kinder to myself",
  "Ask for help if I need it",
  "Take breaks between studying",
  "Connect with a friend",
]

const insights = [
  { text: "You tend to feel better on weekends", icon: "calendar" },
  { text: "Your mood dipped during exam week", icon: "book" },
  { text: "You've been consistently checking in -- great habit!", icon: "star" },
]

export default function MoodPage() {
  const [step, setStep] = useState(1)
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState([5])
  const [intention, setIntention] = useState("")
  const [gratitude, setGratitude] = useState("")
  const [completed, setCompleted] = useState(false)
  const [tab, setTab] = useState("check-in")

  const handleComplete = () => {
    setCompleted(true)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start bg-transparent">
          <TabsTrigger value="check-in" className="data-[state=active]:border-b-2 data-[state=active]:border-secondary">
            Daily Check-In
          </TabsTrigger>
          <TabsTrigger value="tracker" className="data-[state=active]:border-b-2 data-[state=active]:border-secondary">
            Mood Tracker
          </TabsTrigger>
          <TabsTrigger value="insights" className="data-[state=active]:border-b-2 data-[state=active]:border-secondary">
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="check-in" className="mt-6">
          {completed ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center rounded-2xl bg-card p-8 text-center shadow-sm"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-mint">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="mt-4 font-heading text-xl font-semibold text-navy">Check-in Complete!</h2>
              <p className="mt-2 text-muted-foreground">Your streak has been updated. Keep going!</p>
              <button className="mt-4 flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-2 text-sm text-secondary">
                <Share2 className="h-4 w-4" /> Share your mood
              </button>
            </motion.div>
          ) : (
            <div className="rounded-2xl bg-card p-6 shadow-sm md:p-8">
              <h2 className="font-heading text-xl font-semibold text-navy">
                Good morning, Alex!
              </h2>

              {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
                  <p className="text-muted-foreground">How are you feeling right now?</p>
                  <div className="mt-6 flex justify-center gap-4 md:gap-8">
                    {moods.map((mood, i) => (
                      <button
                        key={mood.label}
                        onClick={() => { setSelectedMood(i); setStep(2) }}
                        className="flex flex-col items-center gap-2 transition-transform hover:scale-110"
                      >
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                          style={{ backgroundColor: selectedMood === i ? mood.color : "#F0F6FF" }}
                        >
                          {mood.emoji}
                        </div>
                        <span className="text-xs text-muted-foreground">{mood.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
                  <p className="text-muted-foreground">What{"'"}s your energy level? (1-10)</p>
                  <div className="mt-6 flex items-center gap-4">
                    <span className="text-2xl">{"💤"}</span>
                    <Slider
                      value={energy}
                      onValueChange={setEnergy}
                      max={10}
                      min={1}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-2xl">{"⚡"}</span>
                    <span className="w-8 text-center text-2xl font-bold text-navy">{energy[0]}</span>
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    className="mt-6 rounded-full bg-secondary px-6 py-2 text-sm font-semibold text-white"
                  >
                    Next
                  </button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
                  <p className="text-muted-foreground">What{"'"}s one thing you want to focus on today?</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setIntention(s)}
                        className={`rounded-full px-4 py-2 text-sm transition-colors ${
                          intention === s
                            ? "bg-secondary text-white"
                            : "bg-muted text-muted-foreground hover:bg-secondary/10"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    placeholder="Or write your own..."
                    className="mt-3 rounded-xl"
                    rows={2}
                  />
                  <button
                    onClick={() => setStep(4)}
                    className="mt-4 rounded-full bg-secondary px-6 py-2 text-sm font-semibold text-white"
                  >
                    Next
                  </button>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
                  <p className="text-muted-foreground">What{"'"}s one small thing you{"'"}re grateful for? (optional)</p>
                  <Textarea
                    value={gratitude}
                    onChange={(e) => setGratitude(e.target.value)}
                    placeholder="e.g., A good night's sleep, a friend's text..."
                    className="mt-4 rounded-xl"
                    rows={3}
                  />
                  <button
                    onClick={handleComplete}
                    className="mt-4 rounded-full bg-coral px-6 py-2 text-sm font-semibold text-white"
                  >
                    Complete Check-In
                  </button>
                </motion.div>
              )}

              {/* Step indicator */}
              <div className="mt-8 flex justify-center gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      s <= step ? "bg-secondary" : "bg-border"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tracker" className="mt-6 space-y-6">
          {/* Week View */}
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <h3 className="font-heading text-lg font-semibold text-navy">This Week</h3>
            <div className="mt-4 flex justify-between">
              {weekData.map((d, i) => (
                <div key={d.day} className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm ${
                      i === weekData.length - 1 ? "animate-pulse-glow ring-2 ring-secondary" : ""
                    }`}
                    style={{
                      backgroundColor: moods[d.mood - 1]?.color || "#D1E3F6",
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trend Chart */}
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <h3 className="font-heading text-lg font-semibold text-navy">Mood Trends (Last 7 Days)</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D1E3F6" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#6B7280" }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: "#6B7280" }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="mood" stroke="#4A9FD4" strokeWidth={2} dot={{ fill: "#4A9FD4", r: 4 }} />
                  <Line type="monotone" dataKey="energy" stroke="#4ECDC4" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#4ECDC4", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calendar */}
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <h3 className="font-heading text-lg font-semibold text-navy">Mood Calendar</h3>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {monthData.map((d) => (
                <div
                  key={d.day}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs text-white"
                  style={{ backgroundColor: moods[d.mood - 1]?.color || "#D1E3F6" }}
                >
                  {d.day}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <h3 className="font-heading text-lg font-semibold text-navy">Your Insights</h3>
            <p className="mt-1 text-sm text-muted-foreground">Based on your check-in patterns</p>
            <div className="mt-6 space-y-4">
              {insights.map((insight) => (
                <div key={insight.text} className="flex items-start gap-3 rounded-xl bg-muted p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary/10">
                    <span className="text-sm">{"✨"}</span>
                  </div>
                  <p className="text-sm text-foreground">{insight.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              These are observations, not diagnoses. For professional support, visit{" "}
              <a href="/crisis" className="text-secondary underline">Crisis Support</a>.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
