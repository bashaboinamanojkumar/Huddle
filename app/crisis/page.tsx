import Link from "next/link"
import { ArrowLeft, HeartPulse, Phone, ShieldAlert } from "lucide-react"
import { crisisResources } from "@/lib/config/crisis"

export default function CrisisPage() {
  return (
    <main className="flex min-h-screen justify-center bg-background px-5 py-6 text-foreground">
      <section className="w-full max-w-md">
        <Link href="/app/profile" className="mb-5 inline-flex items-center gap-2 text-sm text-white/62">
          <ArrowLeft className="h-4 w-4" />
          Back to Huddle
        </Link>

        <div className="rounded-[2.5rem] border border-coral/25 bg-coral/12 p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-coral/18">
            <ShieldAlert className="h-8 w-8 text-coral" />
          </div>
          <h1 className="mt-6 font-heading text-3xl font-black leading-tight text-white">
            Immediate help and campus safety
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/64">
            If you or someone nearby is in immediate danger, call 911. Huddle is not emergency care or treatment.
          </p>
          <a
            href="tel:911"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 py-4 text-sm font-black text-white"
          >
            <Phone className="h-4 w-4" />
            Call 911
          </a>
        </div>

        <div className="mt-5 space-y-3">
          {crisisResources.map((resource) => (
            <a key={resource.name} href={resource.href} className="glass-card block rounded-3xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-heading text-sm font-bold text-white">{resource.name}</h2>
                  <p className="mt-1 text-xs leading-5 text-white/52">{resource.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-3 py-2 text-xs font-black text-secondary-foreground">
                  {resource.action}
                </span>
              </div>
            </a>
          ))}
        </div>

        <div className="glass-card mt-5 rounded-[2rem] p-5 text-center">
          <HeartPulse className="mx-auto h-8 w-8 text-mint" />
          <p className="mt-3 text-sm leading-6 text-white/58">
            For non-emergency concerns inside Huddle, use report buttons on activity, chat, or profile screens so a human reviewer can follow up.
          </p>
        </div>
      </section>
    </main>
  )
}
