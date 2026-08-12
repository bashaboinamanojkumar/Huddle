"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const UCLA3_ITEMS = [
  "How often do you feel that you lack companionship?",
  "How often do you feel left out?",
  "How often do you feel isolated from others?",
]

const UCLA3_OPTIONS = [
  { label: "Hardly ever", value: 1 },
  { label: "Some of the time", value: 2 },
  { label: "Often", value: 3 },
]

const PHQ4_ITEMS = [
  { text: "Feeling nervous, anxious, or on edge", subscale: "anxiety" },
  { text: "Not being able to stop or control worrying", subscale: "anxiety" },
  { text: "Feeling down, depressed, or hopeless", subscale: "depression" },
  { text: "Little interest or pleasure in doing things", subscale: "depression" },
]

const PHQ4_OPTIONS = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
]

export default function WellbeingCheckinPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<"intro" | "ucla3" | "phq4" | "done">("intro")
  const [ucla3Answers, setUcla3Answers] = useState<(number | null)[]>([null, null, null])
  const [phq4Answers, setPhq4Answers] = useState<(number | null)[]>([null, null, null, null])
  const [submitting, setSubmitting] = useState(false)

  const ucla3Complete = ucla3Answers.every((a) => a !== null)
  const phq4Complete = phq4Answers.every((a) => a !== null)

  const submit = async () => {
    if (!phq4Complete || submitting) return
    setSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const ucla3Total = (ucla3Answers as number[]).reduce((sum, a) => sum + a, 0)
      const phq4Anxiety = (phq4Answers[0] as number) + (phq4Answers[1] as number)
      const phq4Depression = (phq4Answers[2] as number) + (phq4Answers[3] as number)
      const phq4Total = phq4Anxiety + phq4Depression
      const phq4Band = phq4Total <= 2 ? "normal" : phq4Total <= 5 ? "mild" : phq4Total <= 8 ? "moderate" : "severe"

      await supabase.from("wellbeing_checkins" as any).insert({
        user_id: user.id,
        wave: "baseline",
        instrument: "ucla3+phq4",
        item_scores: [...ucla3Answers, ...phq4Answers],
        ucla3_total: ucla3Total,
        ucla3_lonely_flag: ucla3Total >= 6,
        phq4_anxiety: phq4Anxiety,
        phq4_depression: phq4Depression,
        phq4_total: phq4Total,
        phq4_band: phq4Band,
      })

      await supabase.from("wellbeing_events" as any).insert({
        user_id: user.id,
        event_type: "completed",
        wave: "baseline",
      })

      await supabase
        .from("profiles")
        .update({ baseline_completed_at: new Date().toISOString() } as any)
        .eq("id", user.id)

      // Show resource card if PHQ-4 total >= 9 or either subscale = 6
      if (phq4Total >= 9 || phq4Anxiety === 6 || phq4Depression === 6) {
        setScreen("done")
        return
      }

      setScreen("done")
    } catch {
      // Silent fail — never block the user
    } finally {
      setSubmitting(false)
      setScreen("done")
    }
  }

  const decline = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from("wellbeing_events" as any).insert({
        user_id: user.id,
        event_type: "declined",
        wave: "baseline",
      })

      await supabase
        .from("profiles")
        .update({ baseline_declined_count: 1 } as any)
        .eq("id", user.id)
    } catch {
      // Silent fail
    }
    router.push("/app")
  }

  const showHighScoreResource = () => {
    const phq4Total = (phq4Answers as number[]).reduce((sum, a) => sum + a, 0)
    const phq4Anxiety = (phq4Answers[0] as number) + (phq4Answers[1] as number)
    const phq4Depression = (phq4Answers[2] as number) + (phq4Answers[3] as number)
    return phq4Total >= 9 || phq4Anxiety === 6 || phq4Depression === 6
  }

  return (
    <main className="flex min-h-screen justify-center bg-background text-foreground">
      <section className="flex min-h-screen w-full max-w-md flex-col px-5 py-6">

        {screen === "intro" && (
          <div className="flex flex-1 flex-col">
            <img src="/ollie.png" alt="Ollie" className="mx-auto h-32 w-32 object-contain" style={{ mixBlendMode: "screen" }} />
            <h1 className="mt-6 font-heading text-2xl font-black text-white text-center">
              A quick check-in from the Huddle team
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/70 text-center">
              We're Huddle, a student-built app that helps you find a buddy for the things you already want to do. Before you dive in, we'd like to ask seven short questions about social connection, mood, and worry. It takes under a minute.
            </p>
            <div className="mt-4 rounded-2xl bg-white/8 p-4">
              <p className="text-xs leading-5 text-white/56">
                Your answers are optional and private. They're never shown to other students and never affect how the app works for you. We only look at responses in aggregate, to understand how connection and mood change over time for students using Huddle.
              </p>
              <p className="mt-2 text-xs text-white/40">
                This is not a medical assessment or diagnosis, and it is not a substitute for professional care.
              </p>
            </div>
            <div className="mt-auto space-y-3 pt-8">
              <button
                type="button"
                onClick={() => setScreen("ucla3")}
                className="w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-black text-secondary-foreground"
              >
                Start check-in
              </button>
              <button
                type="button"
                onClick={decline}
                className="w-full rounded-2xl bg-white/8 px-5 py-4 text-sm font-bold text-white/60"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {screen === "ucla3" && (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-1.5 flex-1 rounded-full bg-secondary" />
              <div className="h-1.5 flex-1 rounded-full bg-white/20" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Screen 1 of 2</p>
            <h1 className="mt-2 font-heading text-xl font-black text-white">
              How often do you feel the following ways?
            </h1>
            <div className="mt-6 space-y-6 flex-1">
              {UCLA3_ITEMS.map((item, index) => (
                <div key={index} className="glass-card rounded-[1.5rem] p-4">
                  <p className="text-sm font-semibold text-white mb-3">{item}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {UCLA3_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          const updated = [...ucla3Answers]
                          updated[index] = option.value
                          setUcla3Answers(updated)
                        }}
                        className={`rounded-xl py-2 px-1 text-xs font-bold text-center ${
                          ucla3Answers[index] === option.value
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-white/8 text-white/60"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={!ucla3Complete}
              onClick={() => setScreen("phq4")}
              className="mt-6 w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-black text-secondary-foreground disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {screen === "phq4" && (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-1.5 flex-1 rounded-full bg-secondary" />
              <div className="h-1.5 flex-1 rounded-full bg-secondary" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Screen 2 of 2</p>
            <h1 className="mt-2 font-heading text-xl font-black text-white">
              Over the last two weeks, how often have you been bothered by the following problems?
            </h1>
            <div className="mt-6 space-y-4 flex-1">
              {PHQ4_ITEMS.map((item, index) => (
                <div key={index} className="glass-card rounded-[1.5rem] p-4">
                  <p className="text-sm font-semibold text-white mb-3">{item.text}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PHQ4_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          const updated = [...phq4Answers]
                          updated[index] = option.value
                          setPhq4Answers(updated)
                        }}
                        className={`rounded-xl py-2 px-1 text-xs font-bold text-center ${
                          phq4Answers[index] === option.value
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-white/8 text-white/60"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={!phq4Complete || submitting}
              onClick={submit}
              className="mt-6 w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-black text-secondary-foreground disabled:opacity-40"
            >
              {submitting ? "Saving..." : "Done"}
            </button>
          </div>
        )}

        {screen === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <img src="/ollie.png" alt="Ollie" className="mx-auto h-32 w-32 object-contain" style={{ mixBlendMode: "screen" }} />
            <h1 className="mt-6 font-heading text-2xl font-black text-white">Thanks — that's it.</h1>
            <p className="mt-2 text-sm text-white/60">Your responses have been recorded privately.</p>

            {showHighScoreResource() && (
              <div className="mt-6 rounded-2xl bg-secondary/10 border border-secondary/20 p-4 text-left">
                <p className="text-sm text-white/80 leading-6">
                  Sounds like things might be heavy right now. If you'd like to talk to someone,{" "}
                  
                    <a href="https://counseling.umd.edu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary font-bold underline"
                    >
                    UMD Counseling Center
                  </a>{" "}
                  is free for students.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push("/app")}
              className="mt-8 w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-black text-secondary-foreground"
            >
              Enter Huddle
            </button>
          </div>
        )}
      </section>
    </main>
  )
}