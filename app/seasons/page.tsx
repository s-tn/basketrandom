"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Season {
  id: string
  number: number
  startDate: string
  endDate: string
  active: boolean
}

interface SeasonStanding {
  id: string
  seasonId: string
  playerName: string
  wins: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

interface SeasonReward {
  id: string
  seasonNum: number
  playerName: string
  title: string
  badge: string
  awardedAt: string
}

type Tab = "current" | "past" | "trophies"

function formatTimeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return "Ended"
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}

function goalDiff(s: SeasonStanding): number {
  return s.goalsFor - s.goalsAgainst
}

export default function SeasonsPage() {
  const [tab, setTab] = useState<Tab>("current")
  const [playerName, setPlayerName] = useState("")
  const [playerInput, setPlayerInput] = useState("")

  // Current season state
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null)
  const [standings, setStandings] = useState<SeasonStanding[]>([])
  const [currentLoading, setCurrentLoading] = useState(true)

  // Past seasons state
  const [pastSeasons, setPastSeasons] = useState<Season[]>([])
  const [pastStandings, setPastStandings] = useState<Record<string, SeasonStanding[]>>({})
  const [pastRewards, setPastRewards] = useState<SeasonReward[]>([])
  const [pastLoading, setPastLoading] = useState(false)

  // Trophies state
  const [trophies, setTrophies] = useState<SeasonReward[]>([])
  const [trophiesLoading, setTrophiesLoading] = useState(false)

  // Tick state for countdown
  const [, setTick] = useState(0)

  useEffect(() => {
    const stored = localStorage.getItem("playerName") || ""
    setPlayerInput(stored)
    setPlayerName(stored)
  }, [])

  // Countdown ticker
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Fetch current season on mount
  useEffect(() => {
    fetchCurrentSeason()
  }, [])

  // Fetch trophies when player or tab changes
  useEffect(() => {
    if (tab === "trophies") {
      fetchTrophies(playerName)
    }
  }, [tab, playerName])

  // Fetch past seasons when tab changes
  useEffect(() => {
    if (tab === "past") {
      fetchPastSeasons()
    }
  }, [tab])

  async function fetchCurrentSeason() {
    setCurrentLoading(true)
    const res = await fetch("/api/seasons?type=current")
    const data = await res.json()
    setCurrentSeason(data.season)
    setStandings(data.standings)
    setCurrentLoading(false)
  }

  async function fetchPastSeasons() {
    setPastLoading(true)
    const [seasonsRes, rewardsRes] = await Promise.all([
      fetch("/api/seasons"),
      fetch("/api/seasons?type=rewards"),
    ])
    const allSeasons: Season[] = await seasonsRes.json()
    const allRewards: SeasonReward[] = await rewardsRes.json()
    const finished = allSeasons.filter(s => !s.active)
    setPastSeasons(finished)
    setPastRewards(allRewards)

    // Standings for past seasons are not available via the current API;
    // reward winners (already fetched) are shown instead.
    const standingsMap: Record<string, SeasonStanding[]> = {}
    finished.forEach(season => { standingsMap[season.id] = [] })
    setPastStandings(standingsMap)
    setPastLoading(false)
  }

  async function fetchTrophies(name: string) {
    setTrophiesLoading(true)
    const url = name
      ? `/api/seasons?type=rewards&player=${encodeURIComponent(name)}`
      : "/api/seasons?type=rewards"
    const res = await fetch(url)
    const data = await res.json()
    setTrophies(data)
    setTrophiesLoading(false)
  }

  function handlePlayerSearch() {
    const trimmed = playerInput.trim()
    if (trimmed) localStorage.setItem("playerName", trimmed)
    setPlayerName(trimmed)
    if (tab === "trophies") fetchTrophies(trimmed)
  }

  const btnClass =
    "border-primary text-primary hover:bg-accent hover:text-primary/80 dark:text-primary dark:border-primary"
  const activeBtnClass =
    "bg-primary text-white border-primary hover:bg-primary/80 dark:bg-primary dark:text-primary-foreground dark:border-primary"

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Seasons</h1>
        <p className="text-muted-foreground text-center">
          Weekly competitive seasons with leaderboard resets and rewards for top players.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 justify-center flex-wrap">
        {(["current", "past", "trophies"] as Tab[]).map(t => (
          <Button
            key={t}
            variant="outline"
            size="sm"
            className={tab === t ? activeBtnClass : btnClass}
            onClick={() => setTab(t)}
          >
            {t === "current" && "Current Season"}
            {t === "past" && "Past Seasons"}
            {t === "trophies" && "Trophy Case"}
          </Button>
        ))}
      </div>

      {/* Current Season Tab */}
      {tab === "current" && (
        <div className="space-y-6">
          {currentLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading...</div>
          ) : currentSeason ? (
            <>
              {/* Season info card */}
              <div className="rounded-xl border border-primary/40 bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    Active Season
                  </p>
                  <h2 className="text-2xl font-bold">Season {currentSeason.number}</h2>
                  <p className="text-sm text-muted-foreground">
                    {new Date(currentSeason.startDate).toLocaleDateString()} &mdash;{" "}
                    {new Date(currentSeason.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    Time Remaining
                  </p>
                  <p className="text-xl font-semibold text-primary dark:text-primary">
                    {formatTimeRemaining(currentSeason.endDate)}
                  </p>
                </div>
              </div>

              {/* Standings table */}
              {standings.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No matches recorded yet this season.
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-10">
                          #
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                          Player
                        </th>
                        <th className="text-center px-3 py-3 font-semibold text-muted-foreground">
                          W
                        </th>
                        <th className="text-center px-3 py-3 font-semibold text-muted-foreground">
                          L
                        </th>
                        <th className="text-center px-3 py-3 font-semibold text-muted-foreground">
                          GF
                        </th>
                        <th className="text-center px-3 py-3 font-semibold text-muted-foreground">
                          GA
                        </th>
                        <th className="text-center px-3 py-3 font-semibold text-muted-foreground">
                          +/-
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => {
                        const medal =
                          i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : null
                        return (
                          <tr
                            key={s.id}
                            className={`border-b last:border-0 transition-colors ${
                              i < 3
                                ? "bg-primary/5 dark:bg-primary/5"
                                : "hover:bg-muted/20"
                            }`}
                          >
                            <td className="px-4 py-3 text-muted-foreground font-mono">
                              {medal ?? i + 1}
                            </td>
                            <td className="px-4 py-3 font-medium">{s.playerName}</td>
                            <td className="px-3 py-3 text-center text-green-600 dark:text-green-400 font-semibold">
                              {s.wins}
                            </td>
                            <td className="px-3 py-3 text-center text-red-500 dark:text-red-400 font-semibold">
                              {s.losses}
                            </td>
                            <td className="px-3 py-3 text-center">{s.goalsFor}</td>
                            <td className="px-3 py-3 text-center">{s.goalsAgainst}</td>
                            <td
                              className={`px-3 py-3 text-center font-semibold ${
                                goalDiff(s) > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : goalDiff(s) < 0
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {goalDiff(s) > 0 ? `+${goalDiff(s)}` : goalDiff(s)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              No active season found.
            </div>
          )}
        </div>
      )}

      {/* Past Seasons Tab */}
      {tab === "past" && (
        <div className="space-y-6">
          {pastLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading...</div>
          ) : pastSeasons.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No past seasons yet. Keep playing!
            </div>
          ) : (
            pastSeasons.map(season => {
              const rewards = pastRewards.filter(r => r.seasonNum === season.number)
              const topThree = rewards.filter(r =>
                ["Season Champion", "Runner Up", "Third Place"].includes(r.title)
              )
              return (
                <div
                  key={season.id}
                  className="rounded-xl border bg-card p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-bold">Season {season.number}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(season.startDate).toLocaleDateString()} &mdash;{" "}
                        {new Date(season.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full self-start sm:self-auto">
                      Ended
                    </span>
                  </div>

                  {topThree.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {topThree.map(r => (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/5 px-3 py-2"
                        >
                          <span className="text-xl">{r.badge}</span>
                          <div>
                            <p className="text-xs text-muted-foreground">{r.title}</p>
                            <p className="font-semibold text-sm">{r.playerName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No reward data available.</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Trophy Case Tab */}
      {tab === "trophies" && (
        <div className="space-y-6">
          {/* Player search */}
          <div className="flex gap-3 max-w-sm mx-auto">
            <Input
              placeholder="Enter player name"
              value={playerInput}
              onChange={e => setPlayerInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePlayerSearch()}
            />
            <Button variant="outline" className={btnClass} onClick={handlePlayerSearch}>
              Search
            </Button>
          </div>

          {playerName && (
            <p className="text-center text-sm text-muted-foreground">
              Showing rewards for{" "}
              <span className="font-semibold text-foreground">{playerName}</span>
            </p>
          )}

          {trophiesLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading...</div>
          ) : trophies.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {playerName
                ? `${playerName} has no rewards yet.`
                : "No rewards have been awarded yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trophies.map(r => (
                <div
                  key={r.id}
                  className="rounded-xl border border-primary/40 bg-card p-5 flex flex-col gap-2 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-4xl" role="img" aria-label={r.title}>
                      {r.badge}
                    </span>
                    <div>
                      <p className="font-semibold leading-tight">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Season {r.seasonNum}
                      </p>
                    </div>
                  </div>
                  {!playerName && (
                    <p className="text-sm text-muted-foreground">{r.playerName}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-auto">
                    Awarded {new Date(r.awardedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button
          variant="outline"
          className={btnClass}
          onClick={() => (window.location.href = "/")}
        >
          Back to Home
        </Button>
      </div>
    </div>
  )
}
