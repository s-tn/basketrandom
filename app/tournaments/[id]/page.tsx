"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BracketView } from "@/components/bracket-view"
import { ErrorBoundary } from "@/components/error-boundary"

interface Participant {
  id: string
  playerName: string
  eliminated: boolean
  wins: number
  losses: number
  seed: number | null
}

interface Match {
  id: string
  round: number
  matchIndex: number
  player0: { playerName: string } | null
  player1: { playerName: string } | null
  winner: { playerName: string } | null
  status: string
  roomId: string | null
}

interface Tournament {
  id: string
  name: string
  format: string
  status: string
  streamed: boolean
  private: boolean
  maxPlayers: number
  createdBy: string
  createdAt: string
  participants: Participant[]
  matches: Match[]
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "registration") return "secondary"
  if (status === "in_progress") return "default"
  if (status === "completed") return "outline"
  return "outline"
}

function formatLabel(format: string) {
  return format === "round_robin" ? "Round Robin" : "Bracket"
}

export default function TournamentDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPlayerName(localStorage.getItem("playerName") || "")
    }
  }, [])

  function fetchTournament() {
    if (!id) return
    fetch(`/api/tournaments/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((data) => {
        setTournament(data)
        setLoading(false)
      })
      .catch(() => {
        setError("Tournament not found")
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchTournament()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isParticipant = tournament?.participants.some(
    (p) => p.playerName === playerName
  )

  const isCreator = tournament?.createdBy === playerName

  const canStart =
    isCreator &&
    tournament?.status === "registration" &&
    (tournament?.participants.length ?? 0) >= 2

  async function handleJoin() {
    if (!playerName) {
      alert("Set your player name in localStorage first (key: playerName)")
      return
    }
    setActionLoading(true)
    await fetch(`/api/tournaments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", playerName }),
    })
    fetchTournament()
    setActionLoading(false)
  }

  async function handleLeave() {
    setActionLoading(true)
    await fetch(`/api/tournaments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave", playerName }),
    })
    fetchTournament()
    setActionLoading(false)
  }

  async function handleStart() {
    setActionLoading(true)
    await fetch(`/api/tournaments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", playerName }),
    })
    fetchTournament()
    setActionLoading(false)
  }

  function handleJoinMatch(match: Match) {
    if (match.roomId) {
      window.location.href = `/rooms/${match.roomId}`
    }
  }

  const myReadyMatches = tournament?.matches.filter((m) => {
    if (m.status !== "pending" && m.status !== "live") return false
    const isP0 = m.player0?.playerName === playerName
    const isP1 = m.player1?.playerName === playerName
    return (isP0 || isP1) && m.roomId
  }) ?? []

  // Standings for round_robin
  const standings = tournament?.participants
    .slice()
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses) ?? []

  if (loading) {
    return (
      <div className="container py-12 text-center">
        <p className="text-muted-foreground">Loading tournament...</p>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="container py-12 text-center">
        <p className="text-destructive">{error || "Tournament not found"}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => (window.location.href = "/tournaments")}
        >
          Back to Tournaments
        </Button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div className="container py-8 max-w-4xl mx-auto space-y-6">
      {/* Back nav */}
      <Button
        variant="outline"
        className="border-basketball-orange text-basketball-orange hover:bg-accent hover:text-basketball-darkOrange dark:text-primary dark:border-primary"
        onClick={() => (window.location.href = "/tournaments")}
      >
        Back to Tournaments
      </Button>

      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <CardTitle className="text-2xl">{tournament.name}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{formatLabel(tournament.format)}</Badge>
              <Badge variant={statusVariant(tournament.status)} className="capitalize">
                {tournament.status.replace("_", " ")}
              </Badge>
              {tournament.streamed && <Badge variant="secondary">Streamed</Badge>}
              {tournament.private && <Badge variant="outline">Private</Badge>}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Created by {tournament.createdBy} &middot;{" "}
            {tournament.participants.length}/{tournament.maxPlayers} players
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {tournament.status === "registration" && !isParticipant && (
            <Button
              onClick={handleJoin}
              disabled={actionLoading || tournament.participants.length >= tournament.maxPlayers}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Join Tournament
            </Button>
          )}
          {tournament.status === "registration" && isParticipant && !isCreator && (
            <Button
              variant="outline"
              onClick={handleLeave}
              disabled={actionLoading}
            >
              Leave Tournament
            </Button>
          )}
          {canStart && (
            <Button
              onClick={handleStart}
              disabled={actionLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Start Tournament
            </Button>
          )}
        </CardContent>
      </Card>

      {/* My matches (ready to play) */}
      {myReadyMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Your Matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myReadyMatches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-muted rounded-md px-3 py-2 text-sm"
              >
                <span>
                  Round {m.round} – {m.player0?.playerName ?? "TBD"} vs{" "}
                  {m.player1?.playerName ?? "TBD"}
                </span>
                <Button size="sm" onClick={() => handleJoinMatch(m)}>
                  Join Match
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Participants */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Participants</CardTitle>
        </CardHeader>
        <CardContent>
          {tournament.participants.length === 0 ? (
            <p className="text-muted-foreground text-sm">No participants yet.</p>
          ) : (
            <ul className="space-y-1">
              {tournament.participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                >
                  <span className={p.eliminated ? "line-through text-muted-foreground" : ""}>
                    {p.playerName}
                    {p.playerName === tournament.createdBy && (
                      <span className="ml-1 text-xs text-muted-foreground">(host)</span>
                    )}
                  </span>
                  {tournament.status !== "registration" && (
                    <span className="text-xs text-muted-foreground">
                      {p.wins}W – {p.losses}L
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Bracket or Standings */}
      {(tournament.status === "in_progress" || tournament.status === "completed") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {tournament.format === "bracket" ? "Bracket" : "Standings"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tournament.format === "bracket" ? (
              <BracketView matches={tournament.matches} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">#</th>
                    <th className="pb-2 pr-4 font-medium">Player</th>
                    <th className="pb-2 pr-4 font-medium text-right">W</th>
                    <th className="pb-2 font-medium text-right">L</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((p, i) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5 pr-4 font-medium">{p.playerName}</td>
                      <td className="py-1.5 pr-4 text-right">{p.wins}</td>
                      <td className="py-1.5 text-right">{p.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </ErrorBoundary>
  )
}
