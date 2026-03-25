"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Match {
  id: string
  name: string
  host: string
  opponent: string | null
  winner: number | null
  score0: number
  score1: number
  wins0: number
  wins1: number
  rounds: any
  mode: string
  gravity: number
  timeLimit: number
  scoreMax: number
  roundGoal: number
  createdAt: string
}

interface Replay {
  id: string
  roomId: string
}

function getWinnerName(match: Match): string | null {
  if (match.winner === null) return null
  return match.winner === 0 ? match.host : (match.opponent ?? "Unknown")
}

function MatchCard({ match, playerFilter, replayId }: { match: Match; playerFilter: string; replayId: string | null | undefined }) {

  const winner = getWinnerName(match)
  const playerIsHost = playerFilter && match.host === playerFilter
  const playerIsOpponent = playerFilter && match.opponent === playerFilter
  const playerInMatch = playerIsHost || playerIsOpponent

  let resultLabel: string | null = null
  let resultColor = ""
  if (playerFilter && playerInMatch && match.winner !== null) {
    const playerWon =
      (playerIsHost && match.winner === 0) || (playerIsOpponent && match.winner === 1)
    resultLabel = playerWon ? "WIN" : "LOSS"
    resultColor = playerWon ? "text-green-500" : "text-red-500"
  }

  const isNonDefaultGravity = match.gravity !== 4
  const isNonDefaultTimeLimit = match.timeLimit !== 0

  const date = new Date(match.createdAt)
  const dateStr = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <Card className="hover:bg-accent/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Date */}
          <div className="text-xs text-muted-foreground w-28 shrink-0">
            <div>{dateStr}</div>
            <div>{timeStr}</div>
          </div>

          {/* Room name */}
          <div className="hidden sm:block text-sm text-muted-foreground w-32 shrink-0 truncate" title={match.name}>
            {match.name}
          </div>

          {/* Players */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span
              className={`font-medium text-sm truncate ${
                match.winner === 0 ? "text-primary" : "text-foreground"
              }`}
            >
              {match.host}
            </span>
            <span className="text-muted-foreground text-xs shrink-0">vs</span>
            <span
              className={`font-medium text-sm truncate ${
                match.winner === 1 ? "text-primary" : "text-foreground"
              }`}
            >
              {match.opponent ?? "—"}
            </span>
          </div>

          {/* Series score */}
          <div className="text-sm font-mono shrink-0">
            <span className={match.winner === 0 ? "font-bold" : ""}>{match.wins0}</span>
            <span className="text-muted-foreground mx-1">-</span>
            <span className={match.winner === 1 ? "font-bold" : ""}>{match.wins1}</span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {match.mode ?? "1v1"}
            </Badge>
            {isNonDefaultGravity && (
              <Badge variant="outline" className="text-xs">
                gravity {match.gravity}
              </Badge>
            )}
            {isNonDefaultTimeLimit && (
              <Badge variant="outline" className="text-xs">
                {match.timeLimit}s
              </Badge>
            )}
          </div>

          {/* Win/Loss indicator */}
          {resultLabel && (
            <div className={`text-xs font-bold w-10 text-right shrink-0 ${resultColor}`}>
              {resultLabel}
            </div>
          )}

          {/* Replay link */}
          <div className="w-16 text-right shrink-0">
            {replayId === undefined ? (
              <span className="text-xs text-muted-foreground">…</span>
            ) : replayId ? (
              <Link
                href={`/replays?id=${replayId}`}
                className="text-xs text-primary hover:underline"
              >
                Replay
              </Link>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MatchHistoryPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [replayMap, setReplayMap] = useState<Record<string, string | null>>({})
  const [playerFilter, setPlayerFilter] = useState("")
  const [inputValue, setInputValue] = useState("")
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const LIMIT = 20

  // Pre-fill from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("playerName") ?? ""
    setInputValue(stored)
    setPlayerFilter(stored)
  }, [])

  const fetchMatches = useCallback(
    async (currentOffset: number, filter: string, replace: boolean) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(currentOffset),
        })
        if (filter) params.set("player", filter)
        const res = await fetch(`/api/matches?${params}`)
        const data: Match[] = await res.json()
        if (replace) {
          setMatches(data)
        } else {
          setMatches((prev) => [...prev, ...data])
        }
        setHasMore(data.length === LIMIT)
        setOffset(currentOffset + data.length)
        const roomIds = data.map((m) => m.id).join(',')
        if (roomIds) {
          const nullEntries: Record<string, null> = {}
          for (const m of data) nullEntries[m.id] = null
          setReplayMap((prev) => ({ ...prev, ...nullEntries }))
          try {
            const replayRes = await fetch(`/api/replays?roomIds=${roomIds}`)
            const replays: Replay[] = await replayRes.json()
            const newEntries: Record<string, string> = {}
            for (const r of replays) newEntries[r.roomId] = r.id
            setReplayMap((prev) => ({ ...prev, ...newEntries }))
          } catch {
            // leave as null (no replay)
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Fetch when filter changes
  useEffect(() => {
    setOffset(0)
    setHasMore(true)
    fetchMatches(0, playerFilter, true)
  }, [playerFilter, fetchMatches])

  function applyFilter() {
    setPlayerFilter(inputValue.trim())
  }

  function loadMore() {
    fetchMatches(offset, playerFilter, false)
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Match History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Completed matches across all rooms
        </p>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Filter by player name…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              className="max-w-xs"
            />
            <Button onClick={applyFilter} variant="secondary" size="sm">
              Search
            </Button>
            {playerFilter && (
              <Button
                onClick={() => {
                  setInputValue("")
                  setPlayerFilter("")
                }}
                variant="ghost"
                size="sm"
              >
                Clear
              </Button>
            )}
          </div>
          {playerFilter && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing matches for{" "}
              <span className="font-medium text-foreground">{playerFilter}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Column headers */}
      <div className="hidden sm:flex items-center gap-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="w-28 shrink-0">Date</div>
        <div className="w-32 shrink-0">Room</div>
        <div className="flex-1">Players</div>
        <div className="w-12 shrink-0">Series</div>
        <div className="w-28 shrink-0">Rules</div>
        {playerFilter && <div className="w-10 shrink-0 text-right">Result</div>}
        <div className="w-16 shrink-0 text-right">Replay</div>
      </div>

      {/* Match list */}
      <div className="space-y-2">
        {loading && matches.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        ) : matches.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No completed matches found
              {playerFilter ? ` for "${playerFilter}"` : ""}.
            </CardContent>
          </Card>
        ) : (
          matches.map((match) => (
            <MatchCard key={match.id} match={match} playerFilter={playerFilter} replayId={match.id in replayMap ? replayMap[match.id] : undefined} />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && matches.length > 0 && (
        <div className="flex justify-center">
          <Button onClick={loadMore} variant="outline" disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  )
}
