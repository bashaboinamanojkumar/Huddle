"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { HudrdleLogoFull } from "@/components/hudrdle-logo"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Check, ArrowLeft, ArrowRight, Camera, Sparkles } from "lucide-react"

const supportReasons = [
  "Peer Support", "Someone to Talk To", "Mental Health Resources", "Academic Stress Help",
  "Homesickness & Transition", "Relationship Support", "LGBTQ+ Community", "Anxiety & Stress",
  "Depression Support", "Sleep & Burnout", "International Student Support", "Just Here to Support Others",
]

const hobbies = [
  "Sports", "Music", "Art", "Gaming", "Cooking", "Reading", "Hiking", "Photography",
  "Film", "Dance", "Coding", "Volunteering", "Meditation", "Yoga", "Travel", "Fashion", "Pets",
]

const moods = [
  { label: "Struggling", emoji: "\uD83D\uDE1E", color: "#FF6B6B" },
  { label: "Low", emoji: "\uD83D\uDE14", color: "#FFB347" },
  { label: "Okay", emoji: "\uD83D\uDE10", color: "#87CEEB" },
  { label: "Good", emoji: "\uD83D\uDE0A", color: "#4ECDC4" },
  { label: "Great", emoji: "\uD83D\uDE04", color: "#4ECDC4" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [pronouns, setPronouns] = useState("")
  const [year, setYear] = useState("")
  const [major, setMajor] = useState("")
  const [anonymous, setAnonymous] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([])
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [intention, setIntention] = useState("")
  const [supportMode, setSupportMode] = useState("both")
  const [notifications, setNotifications] = useState({
    dailyCheckIn: true,
    peerMatches: true,
    communityUpdates: true,
    eventReminders: true,
    directMessages: true,
  })
  const [privacy, setPrivacy] = useState({
    showYearMajor: true,
    allowMatching: true,
    allowDMs: false,
  })
  const [complete, setComplete] = useState(false)

  const toggleReason = (r: string) => {
    setSelectedReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    )
  }

  const toggleHobby = (h: string) => {
    if (selectedHobbies.includes(h)) {
      setSelectedHobbies((prev) => prev.filter((x) => x !== h))
    } else if (selectedHobbies.length < 10) {
      setSelectedHobbies((prev) => [...prev, h])
    }
  }

  const handleFinish = () => {
    setComplete(true)
  }

  if (complete) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-navy to-dark-navy p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex flex-col items-center text-center"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-mint">
            <Check className="h-12 w-12 text-white" />
          </div>
          <h1 className="mt-8 font-heading text-3xl font-bold text-white">
            You{"'"}re all set, {name || "friend"}!
          </h1>
          <p className="mt-2 text-white/70">Your Hudrdle is ready</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: "Meet Your First Match", href: "/app/matching" },
              { title: "Explore Communities", href: "/app/communities" },
              { title: "Join Today's Check-In", href: "/app/mood" },
            ].map((action) => (
              <button
                key={action.title}
                onClick={() => router.push(action.href)}
                className="rounded-xl bg-white/10 px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                {action.title}
              </button>
            ))}
          </div>
          <button
            onClick={() => router.push("/app")}
            className="mt-6 rounded-full bg-coral px-8 py-3 font-semibold text-white transition-colors hover:bg-coral/90"
          >
            Go to My Home
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <HudrdleLogoFull className="text-navy" />
        <button
          onClick={() => router.push("/app")}
          className="text-sm text-muted-foreground hover:text-navy"
        >
          Skip
        </button>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-2 px-6 pt-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="h-1.5 flex-1 rounded-full bg-border">
            <div
              className="h-full rounded-full bg-secondary transition-all"
              style={{ width: s <= step ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-6 md:p-12">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-heading text-2xl font-bold text-navy">Tell Us About You</h2>
                <p className="mt-1 text-muted-foreground">Let{"'"}s personalize your experience</p>
                <div className="mt-8 space-y-5">
                  <div className="space-y-2">
                    <Label>Preferred Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Pronouns</Label>
                    <Select value={pronouns} onValueChange={setPronouns}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select pronouns" /></SelectTrigger>
                      <SelectContent>
                        {["He/Him", "She/Her", "They/Them", "Other", "Prefer not to say"].map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Year at UMD</Label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select year" /></SelectTrigger>
                      <SelectContent>
                        {["Freshman", "Sophomore", "Junior", "Senior", "Grad Student"].map((y) => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Major</Label>
                    <Input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g., Computer Science" className="rounded-xl" />
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/10">
                      <Camera className="h-8 w-8 text-secondary" />
                    </div>
                    <span className="text-xs text-muted-foreground">Upload photo (optional)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted p-4">
                    <span className="text-sm">Keep my identity anonymous by default</span>
                    <Switch checked={anonymous} onCheckedChange={setAnonymous} />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-heading text-2xl font-bold text-navy">What Brings You Here?</h2>
                <p className="mt-1 text-muted-foreground">Select all that apply — this helps us match you better</p>
                <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {supportReasons.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => toggleReason(reason)}
                      className={`rounded-xl border-2 p-4 text-left text-sm font-medium transition-all ${
                        selectedReasons.includes(reason)
                          ? "border-secondary bg-secondary/10 text-navy"
                          : "border-border text-muted-foreground hover:border-secondary/50"
                      }`}
                    >
                      {selectedReasons.includes(reason) && <Check className="mb-1 h-4 w-4 text-secondary" />}
                      {reason}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-heading text-2xl font-bold text-navy">Your Interests & Hobbies</h2>
                <p className="mt-1 text-muted-foreground">
                  This helps us connect you with like-minded students (select 3-10)
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {hobbies.map((hobby) => (
                    <button
                      key={hobby}
                      onClick={() => toggleHobby(hobby)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        selectedHobbies.includes(hobby)
                          ? "bg-secondary text-white"
                          : "bg-muted text-muted-foreground hover:bg-secondary/10"
                      }`}
                    >
                      {hobby}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {selectedHobbies.length}/10 selected (minimum 3)
                </p>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-heading text-2xl font-bold text-navy">How Are You Feeling Today?</h2>
                <p className="mt-1 text-muted-foreground">Your first check-in</p>
                <div className="mt-8 flex justify-center gap-4 md:gap-8">
                  {moods.map((mood, i) => (
                    <button
                      key={mood.label}
                      onClick={() => setSelectedMood(i)}
                      className="flex flex-col items-center gap-2 transition-transform"
                      style={{ transform: selectedMood === i ? "scale(1.2)" : "scale(1)" }}
                    >
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-full text-2xl md:h-16 md:w-16"
                        style={{
                          backgroundColor: selectedMood === i ? mood.color : "#F0F6FF",
                          boxShadow: selectedMood === i ? `0 0 20px ${mood.color}40` : "none",
                        }}
                      >
                        {mood.emoji}
                      </div>
                      <span className={`text-xs ${selectedMood === i ? "font-semibold text-navy" : "text-muted-foreground"}`}>
                        {mood.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-8 space-y-2">
                  <Label>Want to share what{"'"}s on your mind? (private, just for you)</Label>
                  <Textarea
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    placeholder="Write anything here..."
                    className="min-h-[100px] rounded-xl"
                  />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  We{"'"}ll check in with you daily. This is always private unless you choose to share.
                </p>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="font-heading text-2xl font-bold text-navy">Set Your Preferences</h2>
                <p className="mt-1 text-muted-foreground">Almost there! Set your boundaries</p>

                <div className="mt-8 space-y-8">
                  <div>
                    <h3 className="font-heading text-sm font-semibold text-navy">Notification Preferences</h3>
                    <div className="mt-4 space-y-3">
                      {[
                        { key: "dailyCheckIn", label: "Daily mood check-in reminder" },
                        { key: "peerMatches", label: "New peer match suggestions" },
                        { key: "communityUpdates", label: "Community activity updates" },
                        { key: "eventReminders", label: "Event reminders" },
                        { key: "directMessages", label: "Direct messages" },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between rounded-xl bg-muted p-3">
                          <span className="text-sm">{item.label}</span>
                          <Switch
                            checked={notifications[item.key as keyof typeof notifications]}
                            onCheckedChange={(v) => setNotifications({ ...notifications, [item.key]: v })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading text-sm font-semibold text-navy">Privacy Defaults</h3>
                    <div className="mt-4 space-y-3">
                      {[
                        { key: "showYearMajor", label: "Show my year and major to others" },
                        { key: "allowMatching", label: "Allow peer matching" },
                        { key: "allowDMs", label: "Allow direct messages from non-matches" },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between rounded-xl bg-muted p-3">
                          <span className="text-sm">{item.label}</span>
                          <Switch
                            checked={privacy[item.key as keyof typeof privacy]}
                            onCheckedChange={(v) => setPrivacy({ ...privacy, [item.key]: v })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading text-sm font-semibold text-navy">Support Mode</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        { value: "receive", label: "I want to receive support" },
                        { value: "give", label: "I want to give support" },
                        { value: "both", label: "Both — I'm here for community" },
                      ].map((mode) => (
                        <button
                          key={mode.value}
                          onClick={() => setSupportMode(mode.value)}
                          className={`rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                            supportMode === mode.value
                              ? "border-secondary bg-secondary/10 text-navy"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-navy disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-sm text-muted-foreground">Step {step} of 5</span>
        {step < 5 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-2 rounded-full bg-secondary px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary/90"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="flex items-center gap-2 rounded-full bg-coral px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral/90"
          >
            <Sparkles className="h-4 w-4" /> Finish Setup
          </button>
        )}
      </div>
    </div>
  )
}
