"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ReplayItem {
  id: string
  roomId: string
  duration: number
  createdAt: string
  room: { name: string; host: string; opponent: string | null }
}

export default function ReplaysPage() {
  const [replays, setReplays] = useState<ReplayItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/replays?limit=50')
      .then(r => r.json())
      .then(setReplays)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function formatDuration(ms: number) {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Replays</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading replays...</p>
      ) : replays.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No replays yet. Play some matches!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {replays.map(replay => (
            <Link key={replay.id} href={`/replays/${replay.id}`}>
              <Card className="hover:border-primary transition cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{replay.room?.name || 'Unknown Room'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {replay.room?.host || '?'} vs {replay.room?.opponent || '?'}
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">{formatDuration(replay.duration)}</Badge>
                    <Badge variant="outline">{new Date(replay.createdAt).toLocaleDateString()}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
