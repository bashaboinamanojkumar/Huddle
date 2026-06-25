import Link from "next/link"
import { WifiOff } from "lucide-react"

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="glass-card max-w-sm rounded-[2rem] p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <WifiOff className="h-8 w-8 text-secondary" />
        </div>
        <h1 className="mt-5 font-heading text-2xl font-bold">You are offline</h1>
        <p className="mt-2 text-sm text-white/64">
          Huddle saved the app shell. Reconnect to refresh events, RSVPs, and chats.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-secondary px-5 py-3 text-sm font-semibold text-secondary-foreground"
        >
          Open saved app
        </Link>
      </div>
    </main>
  )
}
