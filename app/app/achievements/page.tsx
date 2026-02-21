"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Flame, Lock, Info, ChevronDown, ChevronUp, Trophy } from "lucide-react"
import { Progress } from "@/components/ui/progress"

const levelInfo = {
  level: 7,
  title: "Wellness Explorer",
  currentXP: 680,
  nextLevelXP: 1000,
}

const streakInfo = {
  current: 7,
  longest: 14,
  days: [true, true, true, true, true, true, true, false, false, false, false, false, false, false],
}

const badgeCategories = [
  {
    name: "Connection Badges",
    badges: [
      { name: "First Connection", description: "Made your first peer match", icon: "handshake", earned: true, earnedDate: "Jan 15, 2026" },
      { name: "Conversation Starter", description: "Sent your first message", icon: "message", earned: true, earnedDate: "Jan 16, 2026" },
      { name: "Community Builder", description: "Joined 3 communities", icon: "users", earned: true, earnedDate: "Jan 20, 2026" },
      { name: "Super Supporter", description: "Gave support to 10 peers", icon: "heart", earned: false, progress: 7, total: 10 },
      { name: "Bridge Builder", description: "Connected 5 peers with resources", icon: "share", earned: false, progress: 2, total: 5 },
    ],
  },
  {
    name: "Wellness Badges",
    badges: [
      { name: "Consistent", description: "7-day check-in streak", icon: "calendar", earned: true, earnedDate: "Feb 1, 2026" },
      { name: "On Fire", description: "30-day check-in streak", icon: "flame", earned: false, progress: 7, total: 30 },
      { name: "Iron Will", description: "90-day check-in streak", icon: "shield", earned: false, progress: 7, total: 90 },
      { name: "Zen Master", description: "Completed 10 mindfulness exercises", icon: "brain", earned: false, progress: 4, total: 10 },
      { name: "Reflective", description: "Journaled 15 times", icon: "pencil", earned: false, progress: 8, total: 15 },
    ],
  },
  {
    name: "Community Badges",
    badges: [
      { name: "Resource Guru", description: "Shared 5 resources", icon: "book", earned: true, earnedDate: "Feb 10, 2026" },
      { name: "Event Enthusiast", description: "Attended 3 events", icon: "ticket", earned: true, earnedDate: "Feb 14, 2026" },
      { name: "Community Champion", description: "Most helpful in a community (weekly)", icon: "trophy", earned: false, progress: 0, total: 1 },
      { name: "Night Owl", description: "Checked in after midnight", icon: "moon", earned: true, earnedDate: "Jan 25, 2026" },
      { name: "Early Bird", description: "Checked in before 8am 5 times", icon: "sun", earned: false, progress: 3, total: 5 },
    ],
  },
  {
    name: "Milestone Badges",
    badges: [
      { name: "1 Month Member", description: "Been part of Hudrdle for 1 month", icon: "cake", earned: true, earnedDate: "Feb 15, 2026" },
      { name: "3 Month Veteran", description: "A committed community member", icon: "medal-silver", earned: false, progress: 1, total: 3 },
      { name: "6 Month Champion", description: "Half a year of wellness", icon: "medal-gold", earned: false, progress: 1, total: 6 },
      { name: "1 Year Terp", description: "A full year with Hudrdle", icon: "diamond", earned: false, progress: 1, total: 12 },
    ],
  },
]

const xpBreakdown = [
  { action: "Daily check-in", xp: 10 },
  { action: "Sending a supportive message", xp: 5 },
  { action: "Sharing a resource", xp: 5 },
  { action: "Attending an event", xp: 20 },
  { action: "Peer match accepted", xp: 15 },
  { action: "7-day streak bonus", xp: 50 },
]

const leaderboard = [
  { rank: 1, name: "KindTerp23", points: 1240, badge: "Champion" },
  { rank: 2, name: "Anonymous Terp", points: 1180, badge: "Champion" },
  { rank: 3, name: "WellnessWarrior", points: 1050, badge: "Champion" },
  { rank: 4, name: "PeacefulPanda", points: 920, badge: "" },
  { rank: 5, name: "Alex T. (You)", points: 680, badge: "", isUser: true },
]

export default function AchievementsPage() {
  const [expandedXP, setExpandedXP] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const totalEarned = badgeCategories.reduce((acc, cat) => acc + cat.badges.filter(b => b.earned).length, 0)
  const totalBadges = badgeCategories.reduce((acc, cat) => acc + cat.badges.length, 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy">Your Hudrdle Journey</h1>
          <p className="mt-1 text-muted-foreground">Track your growth and celebrate milestones</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-2">
          <Trophy className="h-5 w-5 text-secondary" />
          <span className="text-sm font-semibold text-secondary">Level {levelInfo.level}: {levelInfo.title}</span>
        </div>
      </div>

      {/* XP Progress */}
      <div className="mt-6 rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Experience Points</p>
            <p className="font-heading text-2xl font-bold text-navy">{levelInfo.currentXP} XP</p>
          </div>
          <p className="text-sm text-muted-foreground">{levelInfo.nextLevelXP - levelInfo.currentXP} XP to Level {levelInfo.level + 1}</p>
        </div>
        <Progress value={(levelInfo.currentXP / levelInfo.nextLevelXP) * 100} className="mt-3 h-3 [&>div]:bg-secondary" />
      </div>

      {/* Streak Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-2xl bg-gradient-to-br from-navy to-secondary p-6 text-white shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flame className="h-10 w-10 text-coral" />
            <div>
              <p className="font-heading text-3xl font-bold">{streakInfo.current} Day Streak!</p>
              <p className="text-sm text-white/70">Keep going! Check in tomorrow to reach {streakInfo.current + 1} days</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Longest Streak</p>
            <p className="font-heading text-lg font-bold">{streakInfo.longest} days</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {streakInfo.days.map((active, i) => (
            <div
              key={i}
              className={`h-3 flex-1 rounded-full ${active ? "bg-coral" : "bg-white/20"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-white/50">Last 14 days</p>
      </motion.div>

      {/* Badges */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-navy">Your Badges</h2>
          <span className="text-sm text-muted-foreground">{totalEarned}/{totalBadges} earned</span>
        </div>

        {badgeCategories.map((category) => (
          <div key={category.name} className="mt-6">
            <h3 className="text-sm font-semibold text-navy">{category.name}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {category.badges.map((badge) => (
                <motion.div
                  key={badge.name}
                  whileHover={{ scale: 1.05 }}
                  className={`relative flex flex-col items-center rounded-2xl p-4 text-center transition-shadow ${
                    badge.earned
                      ? "bg-card shadow-sm ring-1 ring-secondary/20"
                      : "bg-muted/50 opacity-70"
                  }`}
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full ${
                      badge.earned
                        ? "bg-gradient-to-br from-secondary to-mint text-white"
                        : "bg-border/50 text-muted-foreground"
                    }`}
                  >
                    {badge.earned ? (
                      <Trophy className="h-6 w-6" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-navy">{badge.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{badge.description}</p>
                  {badge.earned && badge.earnedDate && (
                    <p className="mt-1 text-[10px] text-secondary">{badge.earnedDate}</p>
                  )}
                  {!badge.earned && badge.progress !== undefined && badge.total !== undefined && (
                    <div className="mt-2 w-full">
                      <Progress value={(badge.progress / badge.total) * 100} className="h-1 [&>div]:bg-secondary" />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{badge.progress}/{badge.total}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="mt-8 rounded-2xl bg-card p-6 shadow-sm">
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="flex w-full items-center justify-between"
        >
          <div>
            <h3 className="font-heading text-lg font-semibold text-navy">Community Kindness Champions</h3>
            <p className="text-xs text-muted-foreground">Weekly leaderboard based on supportive interactions</p>
          </div>
          {showLeaderboard ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>
        {showLeaderboard && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 space-y-2 overflow-hidden">
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 rounded-xl p-3 ${
                  (entry as { isUser?: boolean }).isUser ? "bg-secondary/10 ring-1 ring-secondary/20" : "bg-muted/50"
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  entry.rank <= 3 ? "bg-secondary text-white" : "bg-border text-muted-foreground"
                }`}>
                  {entry.rank}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy">{entry.name}</p>
                  {entry.badge && <span className="text-[10px] text-secondary">{entry.badge}</span>}
                </div>
                <span className="text-sm font-semibold text-navy">{entry.points} XP</span>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* How to Earn XP */}
      <div className="mt-6 rounded-2xl bg-card p-6 shadow-sm">
        <button
          onClick={() => setExpandedXP(!expandedXP)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-secondary" />
            <span className="text-sm font-semibold text-navy">How to Earn Points</span>
          </div>
          {expandedXP ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>
        {expandedXP && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-2">
            {xpBreakdown.map((item) => (
              <div key={item.action} className="flex items-center justify-between rounded-lg bg-muted p-3">
                <span className="text-sm text-foreground">{item.action}</span>
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">+{item.xp} XP</span>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
