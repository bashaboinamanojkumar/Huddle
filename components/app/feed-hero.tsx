export interface FeedHeroProps {
  firstName: string
  attendingCount: number
  streakDays: number
  points: number
}

export function FeedHero({
  firstName,
  attendingCount,
  streakDays,
  points,
}: FeedHeroProps) {
  return (
    <section className="glass-card rounded-b-[2.5rem] px-5 pb-6 pt-5" aria-labelledby="feed-greeting">
      <h1 id="feed-greeting" className="font-heading text-3xl font-black leading-none text-white">
        Hey, {firstName} 👋
      </h1>
      <p className="mt-1 text-sm text-white/62">Good to see you. Here's what's happening.</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-3xl bg-white/8 p-3">
          <p className="font-heading text-2xl font-black text-white">{attendingCount}</p>
          <p className="text-[11px] text-white/62">attending</p>
        </div>
        <div className="rounded-3xl bg-white/8 p-3">
          <p className="font-heading text-2xl font-black text-white">{streakDays}</p>
          <p className="text-[11px] text-white/62">day streak</p>
        </div>
        <div className="rounded-3xl bg-white/8 p-3">
          <p className="font-heading text-2xl font-black text-white">{points}</p>
          <p className="text-[11px] text-white/62">points</p>
        </div>
      </div>
    </section>
  )
}
