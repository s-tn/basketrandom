"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Player {
  id: string
  name: string
  elo: number
  wins: number
  losses: number
}

interface MatchStatus {
  inQueue: boolean
  matched: boolean
  roomId?: string
  opponent?: string
}

function getRankLabel(elo: number): string {
  if (elo >= 1600) return "Diamond"
  if (elo >= 1400) return "Platinum"
  if (elo >= 1200) return "Gold"
  if (elo >= 1100) return "Silver"
  return "Bronze"
}

function getRankColor(elo: number): string {
  if (elo >= 1600) return "text-cyan-400"
  if (elo >= 1400) return "text-emerald-400"
  if (elo >= 1200) return "text-yellow-400"
  if (elo >= 1100) return "text-slate-400"
  return "text-orange-700"
}

export default function RankedPage() {
  const [playerName, setPlayerName] = useState("")
  const [playerData, setPlayerData] = useState<Player | null>(null)
  const [searching, setSearching] = useState(false)
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null)
  const [matchFound, setMatchFound] = useState<{ opponent: string; roomId: string } | null>(null)
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [nameInput, setNameInput] = useState("")
  const [nameError, setNameError] = useState("")

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load player name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("playerName")
    if (saved) {
      setPlayerName(saved)
      fetchPlayerData(saved)
    }
    fetchLeaderboard()
  }, [])

  // Redirect to room when match found
  useEffect(() => {
    if (matchFound) {
      const timeout = setTimeout(() => {
        window.location.href = `/rooms/${matchFound.roomId}`
      }, 2500)
      return () => clearTimeout(timeout)
    }
  }, [matchFound])

  async function fetchPlayerData(name: string) {
    try {
      const res = await fetch(`/api/ranked/player?name=${encodeURIComponent(name)}`)
      if (res.ok) {
        const data = await res.json()
        setPlayerData(data)
      }
    } catch {}
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/ranked/leaderboard")
      if (res.ok) {
        const data = await res.json()
        setLeaderboard(Array.isArray(data) ? data : [])
      }
    } catch {}
  }

  function handleSetName() {
    const trimmed = nameInput.trim()
    if (!trimmed) {
      setNameError("Name cannot be empty.")
      return
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      setNameError("Name must be 2–20 characters.")
      return
    }
    setNameError("")
    localStorage.setItem("playerName", trimmed)
    setPlayerName(trimmed)
    fetchPlayerData(trimmed)
  }

  async function joinQueue() {
    if (!playerName) return
    setSearching(true)
    setElapsed(0)

    await fetch("/api/matchmaking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName }),
    })

    // Start elapsed timer
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)

    // Poll for match
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/matchmaking?playerName=${encodeURIComponent(playerName)}`)
        if (!res.ok) return
        const status: MatchStatus = await res.json()
        setMatchStatus(status)

        if (status.matched && status.roomId && status.opponent) {
          clearPolling()
          setSearching(false)
          setMatchFound({ opponent: status.opponent, roomId: status.roomId })
        }
      } catch {}
    }, 2000)
  }

  async function leaveQueue() {
    clearPolling()
    setSearching(false)
    setMatchStatus(null)
    if (playerName) {
      await fetch("/api/matchmaking", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName }),
      })
    }
  }

  function clearPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const elo = playerData?.elo ?? null
  const wins = playerData?.wins ?? 0
  const losses = playerData?.losses ?? 0

  return (
    <div className="container py-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ranked</h1>
        <Button variant="outline" size="sm" onClick={() => (window.location.href = "/")}>
          Back
        </Button>
      </div>

      {/* Player identity */}
      {!playerName ? (
        <Card>
          <CardHeader>
            <CardTitle>Set Your Name</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Enter a name to track your ranked ELO across sessions.
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetName()}
                maxLength={20}
              />
              <Button onClick={handleSetName}>Confirm</Button>
            </div>
            {nameError && <p className="text-destructive text-sm">{nameError}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-lg font-semibold">{playerName}</p>
                <p className="text-sm text-muted-foreground">
                  {wins}W / {losses}L
                </p>
              </div>
              <div className="text-right">
                {elo !== null ? (
                  <>
                    <p className={`text-2xl font-bold ${getRankColor(elo)}`}>{elo} ELO</p>
                    <p className={`text-sm font-medium ${getRankColor(elo)}`}>{getRankLabel(elo)}</p>
                  </>
                ) : (
                  <p className="text-xl font-semibold text-muted-foreground">Unranked</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  localStorage.removeItem("playerName")
                  setPlayerName("")
                  setPlayerData(null)
                  setNameInput("")
                }}
              >
                Change Name
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matchmaking controls */}
      {playerName && !matchFound && (
        <Card>
          <CardHeader>
            <CardTitle>Find a Match</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!searching ? (
              <Button
                className="w-full"
                size="lg"
                onClick={joinQueue}
              >
                Find Match
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                  </div>
                  <p className="text-muted-foreground">
                    Searching for opponent... {elapsed}s
                  </p>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  ELO range expands every 5 seconds
                </p>
                <Button variant="outline" className="w-full" onClick={leaveQueue}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Match found */}
      {matchFound && (
        <Card className="border-primary">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-xl font-bold text-primary">Match Found!</p>
            <p className="text-muted-foreground">
              Opponent: <span className="font-semibold text-foreground">{matchFound.opponent}</span>
            </p>
            <p className="text-sm text-muted-foreground">Redirecting to room...</p>
            <Button
              className="w-full"
              onClick={() => (window.location.href = `/rooms/${matchFound.roomId}`)}
            >
              Join Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No ranked players yet. Play a match to appear here!
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md ${
                    p.name === playerName ? "bg-accent" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground font-mono w-6 text-right text-sm">
                      #{i + 1}
                    </span>
                    <span className="font-medium">{p.name}</span>
                    {p.name === playerName && (
                      <Badge variant="secondary" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {p.wins}W / {p.losses}L
                    </span>
                    <span className={`font-bold ${getRankColor(p.elo)}`}>{p.elo}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
