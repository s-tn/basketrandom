"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

interface BracketMatch {
  id: string
  round: number
  matchIndex: number
  player0: { playerName: string } | null
  player1: { playerName: string } | null
  winner: { playerName: string } | null
  status: string
  roomId: string | null
}

interface BracketViewProps {
  matches: BracketMatch[]
}

function MatchStatusBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <Badge className="bg-green-500 text-white text-xs animate-pulse">
        Live
      </Badge>
    )
  }
  if (status === "completed") {
    return (
      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
        Done
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Pending
    </Badge>
  )
}

function MatchCard({ match }: { match: BracketMatch }) {
  const p0 = match.player0?.playerName ?? "TBD"
  const p1 = match.player1?.playerName ?? "TBD"
  const winnerName = match.winner?.playerName

  return (
    <Card className="w-44 p-2 space-y-1.5 text-sm">
      <div className="flex items-center justify-between gap-1">
        <MatchStatusBadge status={match.status} />
        <span className="text-xs text-muted-foreground">M{match.matchIndex + 1}</span>
      </div>
      <div
        className={`px-2 py-1 rounded text-xs font-medium truncate ${
          winnerName === p0 && match.status === "completed"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {p0}
      </div>
      <div
        className={`px-2 py-1 rounded text-xs font-medium truncate ${
          winnerName === p1 && match.status === "completed"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {p1}
      </div>
    </Card>
  )
}

export function BracketView({ matches }: BracketViewProps) {
  if (!matches || matches.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No matches generated yet.</p>
    )
  }

  // Group by round
  const rounds = matches.reduce<Record<number, BracketMatch[]>>((acc, m) => {
    if (!acc[m.round]) acc[m.round] = []
    acc[m.round].push(m)
    return acc
  }, {})

  const roundNumbers = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex flex-row gap-6 min-w-max">
        {roundNumbers.map((round) => (
          <div key={round} className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground text-center">
              Round {round}
            </h3>
            <div className="flex flex-col gap-4 justify-around flex-1">
              {rounds[round]
                .sort((a, b) => a.matchIndex - b.matchIndex)
                .map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
