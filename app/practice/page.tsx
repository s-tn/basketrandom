"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DrillRunner } from "./drill-runner"

type DrillId = "free" | "timed" | "target"

interface DrillDef {
  id: DrillId
  name: string
  desc: string
  icon: string
}

const DRILLS: DrillDef[] = [
  {
    id: "free",
    name: "Free Shooting",
    desc: "Score as many goals as you can. No time limit. Ball resets after each goal.",
    icon: "basketball",
  },
  {
    id: "timed",
    name: "Timed Challenge",
    desc: "Score as many goals as possible in 60 seconds!",
    icon: "timer",
  },
  {
    id: "target",
    name: "Target Practice",
    desc: "Score 10 goals as fast as you can. Ball spawns at random positions.",
    icon: "target",
  },
]

type PageState = "pick" | "running" | "results"

interface Results {
  drill: DrillId
  score: number
  time: number
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function DrillIcon({ icon }: { icon: string }) {
  if (icon === "basketball") {
    return (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2a10 10 0 0 1 0 20M12 2a10 10 0 0 0 0 20M2 12h20" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M4.9 4.9a10 10 0 0 1 14.2 0M4.9 19.1a10 10 0 0 0 14.2 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    )
  }
  if (icon === "timer") {
    return (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2" />
        <path d="M9 2h6M12 2v2" />
      </svg>
    )
  }
  // target
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

export default function PracticePage() {
  const [pageState, setPageState] = useState<PageState>("pick")
  const [activeDrill, setActiveDrill] = useState<DrillId | null>(null)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<Results | null>(null)
  const [bestScores, setBestScores] = useState<Record<DrillId, { score: number; time: number } | null>>({
    free: null,
    timed: null,
    target: null,
  })

  const startDrill = useCallback((drillId: DrillId) => {
    setActiveDrill(drillId)
    setScore(0)
    setIsRunning(true)
    setTimeLeft(drillId === "timed" ? 60 : 0)
    setPageState("running")
  }, [])

  const handleScore = useCallback(() => {
    setScore((s) => s + 1)
  }, [])

  const handleTimeUpdate = useCallback((t: number) => {
    setTimeLeft(t)
  }, [])

  const handleEnd = useCallback(
    (finalScore: number, finalTime: number) => {
      if (!activeDrill) return
      setIsRunning(false)
      const r: Results = { drill: activeDrill, score: finalScore, time: finalTime }
      setResults(r)
      setPageState("results")

      // Update best scores
      setBestScores((prev) => {
        const existing = prev[activeDrill]
        let better = false
        if (!existing) {
          better = true
        } else if (activeDrill === "target") {
          // Lower time is better; only compare if same target (10 goals)
          better = finalTime < existing.time
        } else {
          better = finalScore > existing.score
        }
        if (better) {
          return { ...prev, [activeDrill]: { score: finalScore, time: finalTime } }
        }
        return prev
      })
    },
    [activeDrill]
  )

  const stopDrill = useCallback(() => {
    if (!activeDrill) return
    setIsRunning(false)
    const r: Results = { drill: activeDrill, score, time: timeLeft }
    setResults(r)
    setPageState("results")

    setBestScores((prev) => {
      const existing = prev[activeDrill]
      const isTarget = activeDrill === "target"
      let better = false
      if (!existing) {
        better = true
      } else if (isTarget) {
        better = score >= 10 && timeLeft < existing.time
      } else {
        better = score > existing.score
      }
      if (better) {
        return { ...prev, [activeDrill]: { score, time: timeLeft } }
      }
      return prev
    })
  }, [activeDrill, score, timeLeft])

  const goBack = useCallback(() => {
    setIsRunning(false)
    setActiveDrill(null)
    setResults(null)
    setScore(0)
    setTimeLeft(0)
    setPageState("pick")
  }, [])

  const tryAgain = useCallback(() => {
    if (!activeDrill) return
    startDrill(activeDrill)
  }, [activeDrill, startDrill])

  // ---- DRILL PICKER ----
  if (pageState === "pick") {
    return (
      <div className="container flex flex-col items-center min-h-screen py-12 space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-center">
            Practice <span className="text-primary">Mode</span>
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            Choose a drill to sharpen your skills solo. The opponent is removed so you can focus on shooting.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
          {DRILLS.map((d) => {
            const best = bestScores[d.id]
            return (
              <Card
                key={d.id}
                className="cursor-pointer border-2 hover:border-primary transition-colors group"
                onClick={() => startDrill(d.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-3">
                    <span className="text-primary group-hover:scale-110 transition-transform">
                      <DrillIcon icon={d.icon} />
                    </span>
                    <span className="text-lg">{d.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{d.desc}</p>
                  {best && (
                    <div className="text-xs font-medium text-primary border border-primary/30 rounded px-2 py-1 bg-primary/5">
                      {d.id === "target"
                        ? `Best: ${formatTime(best.time)} (10 goals)`
                        : `Best: ${best.score} goal${best.score !== 1 ? "s" : ""}`}
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full bg-basketball-orange hover:bg-basketball-darkOrange text-white border-0"
                    onClick={(e) => { e.stopPropagation(); startDrill(d.id) }}
                  >
                    Start
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Button
          variant="outline"
          className="border-basketball-orange text-basketball-orange hover:bg-accent"
          onClick={() => (window.location.href = "/")}
        >
          Back to Home
        </Button>
      </div>
    )
  }

  // ---- RESULTS ----
  if (pageState === "results" && results) {
    const drillDef = DRILLS.find((d) => d.id === results.drill)!
    const best = bestScores[results.drill]
    const isNewBest =
      best &&
      (results.drill === "target"
        ? best.time === results.time
        : best.score === results.score)

    return (
      <div className="container flex flex-col items-center justify-center min-h-screen py-12 space-y-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2 text-primary">
              <DrillIcon icon={drillDef.icon} />
            </div>
            <CardTitle className="text-2xl">{drillDef.name} — Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary">{results.score}</div>
                <div className="text-muted-foreground text-sm mt-1">
                  goal{results.score !== 1 ? "s" : ""}
                </div>
              </div>

              {results.drill === "timed" && (
                <div className="text-center">
                  <div className="text-2xl font-semibold">60s</div>
                  <div className="text-muted-foreground text-sm">time limit</div>
                </div>
              )}

              {results.drill === "target" && results.score >= 10 && (
                <div className="text-center">
                  <div className="text-2xl font-semibold">{formatTime(results.time)}</div>
                  <div className="text-muted-foreground text-sm">time to score 10</div>
                </div>
              )}

              {results.drill === "target" && results.score < 10 && (
                <div className="text-sm text-muted-foreground italic">
                  Drill ended early — {results.score}/10 goals scored
                </div>
              )}

              {isNewBest && (
                <div className="text-sm font-semibold text-primary border border-primary rounded px-3 py-1">
                  New personal best!
                </div>
              )}

              {best && !isNewBest && (
                <div className="text-xs text-muted-foreground">
                  Personal best:{" "}
                  {results.drill === "target"
                    ? formatTime(best.time)
                    : `${best.score} goal${best.score !== 1 ? "s" : ""}`}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-basketball-orange hover:bg-basketball-darkOrange text-white border-0"
                onClick={tryAgain}
              >
                Try Again
              </Button>
              <Button variant="outline" className="flex-1" onClick={goBack}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- RUNNING DRILL ----
  const drillDef = DRILLS.find((d) => d.id === activeDrill)!

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      {/* HUD Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-primary">
            <DrillIcon icon={drillDef.icon} />
          </span>
          <span className="text-white font-semibold text-sm sm:text-base">{drillDef.name}</span>
        </div>

        <div className="flex items-center gap-6">
          {/* Score */}
          <div className="text-center">
            <div className="text-2xl font-bold text-primary leading-none">{score}</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {activeDrill === "target" ? `/ 10` : "goals"}
            </div>
          </div>

          {/* Timer */}
          {activeDrill !== "free" && (
            <div className="text-center">
              <div
                className={`text-2xl font-bold leading-none font-mono ${
                  activeDrill === "timed" && timeLeft <= 10
                    ? "text-red-400"
                    : "text-white"
                }`}
              >
                {formatTime(timeLeft)}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {activeDrill === "timed" ? "remaining" : "elapsed"}
              </div>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            onClick={stopDrill}
          >
            End Drill
          </Button>
        </div>
      </div>

      {/* Game iframe — fills remaining space */}
      <div className="flex-1 relative">
        {activeDrill && (
          <DrillRunner
            drill={activeDrill}
            onScore={handleScore}
            onEnd={handleEnd}
            onTimeUpdate={handleTimeUpdate}
            score={score}
            timeLeft={timeLeft}
            isRunning={isRunning}
          />
        )}
      </div>
    </div>
  )
}
