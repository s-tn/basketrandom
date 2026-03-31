"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
  participants: { id: string }[]
}

function formatLabel(format: string) {
  return format === "round_robin" ? "Round Robin" : "Bracket"
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "registration") return "secondary"
  if (status === "in_progress") return "default"
  if (status === "completed") return "outline"
  return "outline"
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/tournaments")
      .then((r) => r.json())
      .then((data) => {
        setTournaments(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tournaments</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-accent hover:text-primary/80 dark:text-primary dark:border-primary"
            onClick={() => (window.location.href = "/")}
          >
            Home
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => (window.location.href = "/tournaments/create")}
          >
            Create Tournament
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-muted-foreground text-center py-12">Loading tournaments...</p>
      )}

      {!loading && tournaments.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">No tournaments yet</p>
          <p className="text-muted-foreground text-sm mt-1">Be the first to create one!</p>
        </div>
      )}

      {!loading && tournaments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tournaments.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => (window.location.href = `/tournaments/${t.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-tight">{t.name}</CardTitle>
                  <div className="flex gap-1 flex-wrap justify-end shrink-0">
                    <Badge variant="outline">{formatLabel(t.format)}</Badge>
                    <Badge variant={statusVariant(t.status)} className="capitalize">
                      {t.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {t.participants.length} / {t.maxPlayers} players
                  </span>
                  <div className="flex gap-1">
                    {t.streamed && <Badge variant="secondary">Streamed</Badge>}
                    {t.private && <Badge variant="outline">Private</Badge>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  by {t.createdBy}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
