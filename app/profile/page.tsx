"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface AuthUser {
  guest: boolean
  id?: string
  name?: string
  discordAvatar?: string | null
  elo?: number
  wins?: number
  losses?: number
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt: string | null
}

interface SeasonReward {
  id: string
  seasonNum: number
  playerName: string
  title: string
  badge: string
  awardedAt: string
}

function getRankInfo(elo: number): { rank: string; color: string } {
  if (elo >= 1800) return { rank: "Grandmaster", color: "text-yellow-500" }
  if (elo >= 1600) return { rank: "Master", color: "text-purple-500" }
  if (elo >= 1400) return { rank: "Diamond", color: "text-blue-400" }
  if (elo >= 1200) return { rank: "Platinum", color: "text-cyan-500" }
  if (elo >= 1100) return { rank: "Gold", color: "text-yellow-400" }
  if (elo >= 1000) return { rank: "Silver", color: "text-slate-400" }
  return { rank: "Bronze", color: "text-amber-700" }
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [guestName, setGuestName] = useState<string>("")
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [rewards, setRewards] = useState<SeasonReward[]>([])
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("playerName") || "" : ""
    setGuestName(stored)

    fetch("/api/auth/me")
      .then(r => r.json())
      .then((data: AuthUser) => {
        setUser(data)
        const name = data.guest ? stored : data.name!
        if (name) {
          Promise.all([
            fetch(`/api/achievements?player=${encodeURIComponent(name)}`).then(r => r.json()),
            fetch(`/api/seasons?type=rewards&player=${encodeURIComponent(name)}`).then(r => r.json()),
          ]).then(([ach, rew]) => {
            setAchievements(ach)
            setRewards(rew)
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/"
  }

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto py-20 text-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  // Guest view
  if (!user || user.guest) {
    return (
      <div className="container max-w-2xl mx-auto py-16 px-4 space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground text-center">
            Sign in with Discord to unlock persistent stats, achievements, and rewards.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 flex flex-col items-center gap-6 shadow-sm">
          {/* Guest identity */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-primary/20 dark:bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary dark:text-primary">
              {guestName ? guestName[0].toUpperCase() : "?"}
            </div>
            <p className="text-lg font-semibold">{guestName || "Guest"}</p>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
              Guest — localStorage only
            </span>
          </div>

          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Your name is stored locally. Sign in with Discord to save your progress, link your ELO,
            and appear on leaderboards across devices.
          </p>

          <a href="/api/auth/discord">
            <Button className="bg-[#5865F2] hover:bg-[#4752c4] text-white border-0 gap-2 px-6">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Sign in with Discord
            </Button>
          </a>
        </div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            Back
          </Button>
        </div>
      </div>
    )
  }

  // Authenticated view
  const elo = user.elo ?? 1000
  const wins = user.wins ?? 0
  const losses = user.losses ?? 0
  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  const { rank, color } = getRankInfo(elo)
  const unlockedCount = achievements.filter(a => a.unlocked).length

  const initials = (user.name ?? "?")[0].toUpperCase()

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">Your stats, achievements, and season rewards</p>
      </div>

      {/* Identity card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          {user.discordAvatar ? (
            <img
              src={user.discordAvatar}
              alt={user.name}
              className="w-20 h-20 rounded-full border-2 border-primary/40 dark:border-primary/40 object-cover shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/20 dark:bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary dark:text-primary shrink-0">
              {initials}
            </div>
          )}

          {/* Name + rank */}
          <div className="flex-1 text-center sm:text-left space-y-1">
            <p className="text-xl font-bold">{user.name}</p>
            <p className={`text-sm font-semibold ${color}`}>{rank}</p>
            <p className="text-2xl font-mono font-bold text-primary dark:text-primary">
              {elo} <span className="text-sm font-normal text-muted-foreground">ELO</span>
            </p>
          </div>

          {/* Logout */}
          <Button
            variant="outline"
            size="sm"
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>

      {/* W/L record */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{wins}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Wins</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-red-500 dark:text-red-400">{losses}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Losses</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <p className="text-2xl font-bold">{winRate}%</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Win Rate</p>
        </div>
      </div>

      {/* Achievements */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Achievements</h2>
          <span className="text-sm text-muted-foreground">
            {unlockedCount} / {achievements.length} unlocked
          </span>
        </div>

        {achievements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No achievements data.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {achievements.map(a => (
              <div
                key={a.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  a.unlocked
                    ? "border-primary/40 bg-primary/5 dark:bg-primary/5"
                    : "border-muted/40 bg-muted/10 opacity-50"
                }`}
              >
                <span className="text-2xl" role="img" aria-label={a.name}>
                  {a.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                  {a.unlocked && a.unlockedAt && (
                    <p className="text-xs text-primary dark:text-primary mt-0.5">
                      {new Date(a.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Season rewards */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-lg">Season Rewards</h2>

        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No season rewards yet. Compete in ranked matches to earn end-of-season prizes!
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {rewards.map(r => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/5 px-3 py-2"
              >
                <span className="text-3xl">{r.badge}</span>
                <div>
                  <p className="font-semibold text-sm leading-tight">{r.title}</p>
                  <p className="text-xs text-muted-foreground">Season {r.seasonNum}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 justify-center pt-2">
        <Button variant="outline" onClick={() => (window.location.href = "/ranked")}>
          Ranked Play
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/seasons")}>
          Seasons
        </Button>
      </div>
    </div>
  )
}
