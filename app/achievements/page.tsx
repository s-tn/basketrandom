"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt: string | null
}

export default function AchievementsPage() {
  const [playerName, setPlayerName] = useState("")
  const [inputValue, setInputValue] = useState("")
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("playerName") || ""
    setInputValue(stored)
    if (stored) {
      setPlayerName(stored)
    } else {
      fetchAchievements("")
    }
  }, [])

  useEffect(() => {
    if (playerName !== undefined) {
      fetchAchievements(playerName)
    }
  }, [playerName])

  async function fetchAchievements(name: string) {
    setLoading(true)
    const url = name ? `/api/achievements?player=${encodeURIComponent(name)}` : "/api/achievements"
    const res = await fetch(url)
    const data = await res.json()
    setAchievements(data)
    setLoading(false)
  }

  function handleSearch() {
    const trimmed = inputValue.trim()
    if (trimmed) {
      localStorage.setItem("playerName", trimmed)
    }
    setPlayerName(trimmed)
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const total = achievements.length

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 space-y-8">
      <div className="flex flex-col items-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Achievements
        </h1>
        <p className="text-muted-foreground text-center">
          Unlock achievements by playing matches, scoring goals, and competing in tournaments.
        </p>
      </div>

      <div className="flex gap-3 max-w-sm mx-auto">
        <Input
          placeholder="Enter player name"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
        />
        <Button
          variant="outline"
          onClick={handleSearch}
        >
          Search
        </Button>
      </div>

      {!loading && achievements.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{unlockedCount}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span> unlocked
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map(a => (
            <div
              key={a.id}
              className={`rounded-xl border p-5 flex flex-col gap-2 transition-all ${
                a.unlocked
                  ? "bg-card border-primary/40 shadow-sm"
                  : "bg-muted/30 border-muted opacity-60 grayscale"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl" role="img" aria-label={a.name}>
                  {a.unlocked ? a.icon : "🔒"}
                </span>
                <div>
                  <p className={`font-semibold leading-tight ${a.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                    {a.name}
                  </p>
                  {a.unlocked && a.unlockedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-snug">{a.description}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
