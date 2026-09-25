import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowLeft, MailCheck } from "lucide-react"
import { EMAIL_CONFIRMATION_COOKIE, isConfirmableOtpType } from "@/lib/auth/confirm"
import { normalizeReturnPath } from "@/lib/auth/policy"

type SearchValue = string | string[] | undefined

interface ConfirmationReviewPageProps {
  searchParams: Promise<Record<string, SearchValue>>
}

function first(value: SearchValue): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

export default async function ConfirmationReviewPage({
  searchParams,
}: ConfirmationReviewPageProps) {
  const params = await searchParams
  const kind = first(params.kind)
  const type = first(params.type)
  const next = normalizeReturnPath(first(params.next))
  const cookieStore = await cookies()
  const hasStagedToken = Boolean(cookieStore.get(EMAIL_CONFIRMATION_COOKIE)?.value)
  const isValid = kind === "token_hash" && isConfirmableOtpType(type) && hasStagedToken

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-6 text-foreground">
      <div className="w-full max-w-md">
        <Link href="/verify" className="mb-5 inline-flex items-center gap-2 text-sm text-white/58">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="glass-card rounded-[2.25rem] p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/18">
            <MailCheck className="h-7 w-7 text-secondary" />
          </div>

          {isValid ? (
            <>
              <h1 className="mt-6 font-heading text-3xl font-black tracking-tight text-white">
                Confirm your email.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Campus email security may check links automatically. Press the button below so
                Huddle confirms this one-time link only when you are ready.
              </p>

              <form action="/auth/confirm" method="post">
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="next" value={next} />
                <button
                  type="submit"
                  className="mt-7 w-full rounded-2xl bg-secondary px-5 py-4 text-sm font-bold text-secondary-foreground"
                >
                  {type === "recovery"
                    ? "Continue to reset password"
                    : "Confirm email and create account"}
                </button>
              </form>

              <p className="mt-5 text-center text-xs leading-5 text-white/42">
                Only continue if you requested this email from Huddle.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-heading text-3xl font-black tracking-tight text-white">
                This link is incomplete.
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Return to sign in and request a new confirmation email.
              </p>
              <Link
                href="/verify?mode=signup"
                className="mt-7 block w-full rounded-2xl bg-secondary px-5 py-4 text-center text-sm font-bold text-secondary-foreground"
              >
                Request a new link
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
