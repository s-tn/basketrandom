"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface Clip {
  id: string
  player: string | null
  duration: number
  createdAt: string
  url: string
  roomId: string
}

const LIMIT = 20

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([])
  const [filter, setFilter] = useState("")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)

  const fetchClips = useCallback(async (currentOffset: number, playerFilter: string, replace: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(currentOffset),
      })
      if (playerFilter.trim()) {
        params.set("player", playerFilter.trim())
      }
      const res = await fetch(`/api/clips?${params}`)
      if (!res.ok) throw new Error("Failed to fetch clips")
      const data: Clip[] = await res.json()
      setClips(prev => replace ? data : [...prev, ...data])
      setHasMore(data.length === LIMIT)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchClips(0, "", true)
  }, [fetchClips])

  // Re-fetch when filter changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0)
      fetchClips(0, filter, true)
    }, 300)
    return () => clearTimeout(timer)
  }, [filter, fetchClips])

  const handleLoadMore = () => {
    const nextOffset = offset + LIMIT
    setOffset(nextOffset)
    fetchClips(nextOffset, filter, false)
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="container py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Clip <span className="text-primary">Gallery</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Browse highlight clips from recent games</p>
        </div>
        <Button
          variant="outline"
          className="border-basketball-orange text-basketball-orange hover:bg-accent hover:text-basketball-darkOrange dark:text-primary dark:border-primary w-fit"
          onClick={() => (window.location.href = "/")}
        >
          Back to Home
        </Button>
      </div>

      <div className="max-w-sm">
        <Input
          type="text"
          placeholder="Filter by player name..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {initialLoad ? (
        <div className="text-center py-20 text-muted-foreground">Loading clips...</div>
      ) : clips.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-2xl font-semibold text-muted-foreground">No clips yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            {filter ? `No clips found for "${filter}"` : "Play some games and save your highlights!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {clips.map(clip => (
              <Card key={clip.id} className="overflow-hidden">
                <video
                  src={clip.url}
                  controls
                  className="w-full aspect-video bg-black object-contain"
                  preload="metadata"
                />
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate text-sm">
                      {clip.player ?? "Unknown Player"}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {formatDuration(clip.duration)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatTimestamp(clip.createdAt)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                className="border-basketball-orange text-basketball-orange hover:bg-accent hover:text-basketball-darkOrange dark:text-primary dark:border-primary px-8"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
