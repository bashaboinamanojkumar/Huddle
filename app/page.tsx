import Link from "next/link"
import { ArrowRight, CalendarHeart, MessageCircle, ShieldCheck, Sparkles, UsersRound } from "lucide-react"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-6">
        <div className="hero-gradient relative overflow-hidden rounded-[2.5rem] px-6 pb-7 pt-10 shadow-2xl shadow-black/40">
          <div className="absolute -right-16 top-8 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-black/30 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5" />
              UMD pilot for real-life meetups
            </div>
            <h1 className="mt-8 font-heading text-5xl font-black leading-[0.95] tracking-tight text-white">
              Find your next small group.
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/76">
              Huddle helps university students join low-pressure public activities with limited seats, shared interests, and safer meet-points.
            </p>
            <Link
              href="/verify"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black"
            >
              Start with campus email
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "RSVP", value: "1 tap" },
            { label: "Group", value: "2-8" },
            { label: "Campus", value: "UMD" },
          ].map((item) => (
            <div key={item.label} className="glass-card rounded-3xl p-4 text-center">
              <p className="font-heading text-xl font-bold text-white">{item.value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-white/48">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {[
            {
              icon: CalendarHeart,
              title: "Activity-first",
              body: "Browse public activities and RSVP without awkward open-ended matching.",
            },
            {
              icon: UsersRound,
              title: "Smart-sort fit",
              body: "Events rank by interests, availability, and group-size comfort.",
            },
            {
              icon: MessageCircle,
              title: "Logistics chat",
              body: "Group chat opens when at least two students are going.",
            },
            {
              icon: ShieldCheck,
              title: "Safety by design",
              body: "Public meet-points, report flows, crisis links, and human review.",
            },
          ].map((feature) => (
            <div key={feature.title} className="glass-card flex items-start gap-4 rounded-3xl p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <feature.icon className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <h2 className="font-heading text-sm font-bold text-white">{feature.title}</h2>
                <p className="mt-1 text-xs leading-5 text-white/58">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-auto pt-8 text-center text-xs leading-5 text-white/40">
          Built for a university mental health competition. Huddle is not treatment, therapy, or emergency support.
        </p>
      </section>
    </main>
  )
}
