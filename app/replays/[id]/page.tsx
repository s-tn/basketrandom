"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function ReplayViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [replay, setReplay] = useState<any>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const playbackRef = useRef<{ time: number; index: number; lastFrame: number; raf: number | null }>({
    time: 0, index: 0, lastFrame: 0, raf: null,
  })
  const statesRef = useRef<Array<{ t: number; s: number[] }>>([])

  useEffect(() => {
    fetch(`/api/replays/${id}`)
      .then(r => r.json())
      .then(data => {
        setReplay(data)
        statesRef.current = JSON.parse(data.data)
      })
      .catch(() => {})
  }, [id])

  const playbackLoop = useCallback(() => {
    const pb = playbackRef.current
    const states = statesRef.current
    if (!playing || states.length === 0) {
      pb.raf = requestAnimationFrame(playbackLoop)
      return
    }

    const now = performance.now()
    const delta = (now - pb.lastFrame) * speed
    pb.lastFrame = now
    pb.time += delta
    setElapsed(pb.time)

    if (replay) {
      setProgress(Math.min((pb.time / replay.duration) * 100, 100))
    }

    while (pb.index < states.length && states[pb.index].t <= pb.time) {
      const iframe = document.getElementById('replay-frame') as HTMLIFrameElement
      iframe?.contentWindow?.postMessage({ type: 'replayState', state: states[pb.index].s }, '*')
      pb.index++
    }

    if (pb.index >= states.length) {
      setPlaying(false)
      return
    }

    pb.raf = requestAnimationFrame(playbackLoop)
  }, [playing, speed, replay])

  useEffect(() => {
    if (playing) {
      playbackRef.current.lastFrame = performance.now()
      playbackRef.current.raf = requestAnimationFrame(playbackLoop)
    }
    return () => {
      if (playbackRef.current.raf) cancelAnimationFrame(playbackRef.current.raf)
    }
  }, [playing, playbackLoop])

  function togglePlay() {
    if (!playing && playbackRef.current.index >= statesRef.current.length) {
      // Reset if at end
      playbackRef.current.time = 0
      playbackRef.current.index = 0
      setProgress(0)
      setElapsed(0)
    }
    setPlaying(!playing)
  }

  function seek(pct: number) {
    if (!replay) return
    const time = (pct / 100) * replay.duration
    playbackRef.current.time = time
    playbackRef.current.index = statesRef.current.findIndex(s => s.t > time)
    if (playbackRef.current.index === -1) playbackRef.current.index = statesRef.current.length
    setProgress(pct)
    setElapsed(time)
  }

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${m}:${String(s % 60).padStart(2, '0')}`
  }

  if (!replay) {
    return <div className="container mx-auto p-6"><p className="text-muted-foreground">Loading replay...</p></div>
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{replay.room?.name || 'Replay'}</h1>
          <p className="text-sm text-muted-foreground">
            {replay.room?.host} vs {replay.room?.opponent}
          </p>
        </div>
        <Badge>Replay</Badge>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-black aspect-video">
            <iframe
              src={`/game.html?spectate=true#${btoa(`/api/headless/${replay.roomId}`)}`}
              className="w-full h-full"
              title="Replay"
              id="replay-frame"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={togglePlay}>
              {playing ? 'Pause' : (playbackRef.current.index >= statesRef.current.length ? 'Replay' : 'Play')}
            </Button>

            <div className="flex gap-1">
              {[0.5, 1, 2].map(s => (
                <Button key={s} size="sm" variant={speed === s ? "default" : "outline"} onClick={() => setSpeed(s)}>
                  {s}x
                </Button>
              ))}
            </div>

            <span className="text-sm font-mono text-muted-foreground ml-auto">
              {formatTime(elapsed)} / {formatTime(replay.duration)}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full"
          />
        </CardContent>
      </Card>
    </div>
  )
}
