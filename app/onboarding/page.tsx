"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, GraduationCap, ShieldCheck, Sparkles } from "lucide-react"
import { CategoryIcon } from "@/components/huddle/category-icon"
import { availabilityMeta, categoryMeta } from "@/lib/data/seed"
import { useHuddle } from "@/lib/store/huddle-store"
import type { AvailabilityBlock, Category, ComfortSize, Gender, SafetyPreference, StudentStatus } from "@/lib/types/huddle"

const statuses: { id: StudentStatus; label: string }[] = [
  { id: "undergrad_1", label: "Freshman" },
  { id: "undergrad_2", label: "Sophomore" },
  { id: "undergrad_3", label: "Junior" },
  { id: "undergrad_4", label: "Senior" },
  { id: "masters", label: "Master's" },
  { id: "phd", label: "PhD" },
  { id: "postdoc", label: "Postdoc" },
  { id: "other", label: "Other" },
]

const comfortOptions: { id: ComfortSize; label: string; detail: string }[] = [
  { id: "small", label: "Small", detail: "2-3 people" },
  { id: "medium", label: "Medium", detail: "4-6 people" },
  { id: "either", label: "Either", detail: "Sort by fit" },
]

const safetyOptions: { id: SafetyPreference; label: string; detail: string }[] = [
  { id: "none", label: "No preference", detail: "Use normal sorting" },
  { id: "mixed", label: "Prefer mixed groups", detail: "Boost mixed activities" },
  { id: "women_only", label: "Same-sex groups", detail: "Hard filter when offered" },
  { id: "same_gender", label: "Same-gender", detail: "Inclusive of LGBTQ+ identities" },
]

const genderOptions: { id: Gender; label: string }[] = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "transgender_woman", label: "Transgender woman" },
  { id: "transgender_man", label: "Transgender man" },
  { id: "lesbian", label: "Lesbian" },
  { id: "gay", label: "Gay" },
  { id: "bisexual", label: "Bisexual" },
  { id: "non_binary", label: "Non-binary" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
]

function SelectCard({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-16 rounded-3xl border p-4 text-left transition-colors ${
        active ? "border-secondary bg-secondary/18 text-white" : "border-white/10 bg-white/6 text-white/72"
      }`}
    >
      {active && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      {children}
    </button>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const { currentProfile, completeOnboarding } = useHuddle()
  const [step, setStep] = useState(1)
  const [status, setStatus] = useState<StudentStatus>(currentProfile.status)
  const [interests, setInterests] = useState<Category[]>(currentProfile.interests)
  const [availability, setAvailability] = useState<AvailabilityBlock[]>(currentProfile.availabilityBlocks)
  const [comfortSize, setComfortSize] = useState<ComfortSize>(currentProfile.comfortSize)
  const [safetyPreference, setSafetyPreference] = useState<SafetyPreference>(currentProfile.safetyPreference)
  const [gender, setGender] = useState<Gender | undefined>(currentProfile.gender)

  const canContinue = useMemo(() => {
    if (step === 2) return interests.length >= 3 && interests.length <= 8
    if (step === 3) return availability.length > 0
    return true
  }, [availability.length, interests.length, step])

  const toggleInterest = (category: Category) => {
    setInterests((prev) => {
      if (prev.includes(category)) return prev.filter((item) => item !== category)
      if (prev.length >= 8) return prev
      return [...prev, category]
    })
  }

  const toggleAvailability = (block: AvailabilityBlock) => {
    setAvailability((prev) =>
      prev.includes(block) ? prev.filter((item) => item !== block) : [...prev, block]
    )
  }

  const finish = () => {
    completeOnboarding({
      firstName: currentProfile.firstName,
      lastInitial: currentProfile.lastInitial,
      status,
      gender,
      interests,
      availabilityBlocks: availability,
      comfortSize,
      safetyPreference,
    })
    router.push("/app")
  }

  return (
    <main className="flex min-h-screen justify-center bg-background text-foreground">
      <section className="flex min-h-screen w-full max-w-md flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-secondary">Huddle setup</p>
            <h1 className="mt-1 font-heading text-2xl font-black text-white">Build your activity fit</h1>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Sparkles className="h-5 w-5 text-secondary" />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-1.5 flex-1 rounded-full bg-white/10">
              <div className={`h-full rounded-full bg-secondary transition-all ${item <= step ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>

        <div className="mt-6 flex-1">
          {step === 1 && (
            <div>
              <div className="glass-card rounded-[2rem] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <GraduationCap className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-bold text-white">Your campus status</h2>
                    <p className="text-sm text-white/54">Campus is set from your verified email.</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {statuses.map((item) => (
                    <SelectCard key={item.id} active={status === item.id} onClick={() => setStatus(item.id)}>
                      <span className="pr-6 text-sm font-semibold">{item.label}</span>
                    </SelectCard>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-heading text-xl font-bold text-white">Pick 3-8 interests</h2>
              <p className="mt-1 text-sm text-white/54">{interests.length}/8 selected. These power smart-sort.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {categoryMeta.map((category) => (
                  <SelectCard
                    key={category.id}
                    active={interests.includes(category.id)}
                    onClick={() => toggleInterest(category.id)}
                  >
                    <CategoryIcon category={category.id} className="mb-3 h-5 w-5 text-secondary" />
                    <span className="block pr-6 text-sm font-semibold">{category.shortLabel}</span>
                  </SelectCard>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-heading text-xl font-bold text-white">When can you meet?</h2>
              <p className="mt-1 text-sm text-white/54">Broad blocks only. No calendar grid needed.</p>
              <div className="mt-5 grid gap-3">
                {availabilityMeta.map((block) => (
                  <SelectCard
                    key={block.id}
                    active={availability.includes(block.id)}
                    onClick={() => toggleAvailability(block.id)}
                  >
                    <span className="text-sm font-semibold">{block.label}</span>
                  </SelectCard>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="glass-card rounded-[2rem] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <ShieldCheck className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-bold text-white">Comfort settings</h2>
                    <p className="text-sm text-white/54">Used as sort weight unless marked hard filter.</p>
                  </div>
                </div>
                <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/46">Group size</h3>
                <div className="mt-3 grid gap-3">
                  {comfortOptions.map((item) => (
                    <SelectCard key={item.id} active={comfortSize === item.id} onClick={() => setComfortSize(item.id)}>
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-1 block text-xs text-white/48">{item.detail}</span>
                    </SelectCard>
                  ))}
                </div>
                <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/46">Safety preference</h3>
                <div className="mt-3 grid gap-3">
                  {safetyOptions.map((item) => (
                    <SelectCard
                      key={item.id}
                      active={safetyPreference === item.id}
                      onClick={() => setSafetyPreference(item.id)}
                    >
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-1 block text-xs text-white/48">{item.detail}</span>
                    </SelectCard>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {step === 5 && (
            <div>
              <h2 className="font-heading text-xl font-bold text-white">Your gender identity</h2>
              <p className="mt-1 text-sm text-white/54">Optional — helps us personalise your experience.</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                {genderOptions.map((item) => (
                  <SelectCard
                    key={item.id}
                    active={gender === item.id}
                    onClick={() => setGender(item.id)}
                  >
                  <span className="pr-6 text-sm font-semibold">{item.label}</span>
                  </SelectCard>
                ))}
                </div>
            </div>
          )}
        </div>

        <div className="safe-pb mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
            className="flex-1 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white/72 disabled:opacity-40"
            disabled={step === 1}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (step === 5 ? finish() : setStep((prev) => prev + 1))}
            disabled={!canContinue}
            className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground disabled:opacity-45"
          >
            {step === 4 ? "Enter Huddle" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </main>
  )
}
