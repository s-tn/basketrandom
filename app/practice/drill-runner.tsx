"use client"

import { useEffect, useRef, useCallback } from "react"

interface DrillRunnerProps {
  drill: string
  onScore: () => void
  onEnd: (finalScore: number, finalTime: number) => void
  onTimeUpdate: (t: number) => void
  score: number
  timeLeft: number
  isRunning: boolean
}

export function DrillRunner({
  drill,
  onScore,
  onEnd,
  onTimeUpdate,
  score,
  timeLeft,
  isRunning,
}: DrillRunnerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scoreRef = useRef(score)
  const timeRef = useRef(timeLeft)
  const isRunningRef = useRef(isRunning)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const drillInitializedRef = useRef(false)

  // Keep refs in sync with props
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { timeRef.current = timeLeft }, [timeLeft])
  useEffect(() => { isRunningRef.current = isRunning }, [isRunning])

  const resetBall = useCallback((randomX = false) => {
    const cw = iframeRef.current?.contentWindow as any
    if (!cw) return
    try {
      const ball = cw.c3_runtimeInterface._localRuntime._iRuntime.objects.balls.getAllInstances()[0]
      if (ball) {
        ball.x = randomX ? 100 + Math.random() * 400 : 200
        ball.y = 50
        ball.behaviors.Physics.setVelocity(0, 0)
        ball.instVars.hold = false
        ball.instVars.who = 0
      }
    } catch (_) {
      // C3 objects may not be ready yet
    }
  }, [])

  const hideOpponent = useCallback(() => {
    const cw = iframeRef.current?.contentWindow as any
    if (!cw) return
    try {
      const objs = cw.c3_runtimeInterface._localRuntime._iRuntime.objects
      const parts = [objs.body3?.getAllInstances()[0], objs.body4?.getAllInstances()[0]]
      for (const b of parts) {
        if (b) { b.x = -1000; b.y = -1000 }
      }
    } catch (_) {
      // C3 objects may not be ready yet
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()

    if (drill === "timed") {
      // Countdown from 60
      timerIntervalRef.current = setInterval(() => {
        if (!isRunningRef.current) { clearTimer(); return }
        const next = timeRef.current - 1
        onTimeUpdate(next)
        if (next <= 0) {
          clearTimer()
          onEnd(scoreRef.current, 0)
        }
      }, 1000)
    } else if (drill === "target") {
      // Count up
      timerIntervalRef.current = setInterval(() => {
        if (!isRunningRef.current) { clearTimer(); return }
        onTimeUpdate(timeRef.current + 1)
      }, 1000)
    }
  }, [drill, clearTimer, onTimeUpdate, onEnd])

  const setupDrill = useCallback(() => {
    const cw = iframeRef.current?.contentWindow as any
    if (!cw) return

    // Hide opponent for all drills
    hideOpponent()
    // Reset ball to starting position
    resetBall(drill === "target")

    // Hook into audio to detect goals (same pattern as offline-game.tsx)
    try {
      cw.AudioDOMHandler.prototype._Play = new Proxy(cw.AudioDOMHandler.prototype._Play, {
        apply: (target: any, thisArg: any, argumentsList: any[]) => {
          if (argumentsList[0]?.originalUrl === "file" && isRunningRef.current) {
            onScore()

            if (drill === "target") {
              // Count up to 10 goals
              const newScore = scoreRef.current + 1
              if (newScore >= 10) {
                setTimeout(() => onEnd(newScore, timeRef.current), 100)
              } else {
                setTimeout(() => resetBall(true), 300)
              }
            } else {
              // free or timed: reset ball to player side
              setTimeout(() => resetBall(false), 300)
            }
          }
          return false
        }
      })
    } catch (_) {
      // proxy setup failed
    }

    startTimer()
    drillInitializedRef.current = true
  }, [drill, hideOpponent, resetBall, onScore, onEnd, startTimer])

  const handleIframeLoad = useCallback(() => {
    const cw = iframeRef.current?.contentWindow as any
    if (!cw) return

    // Mirror the offline-game.tsx pattern: proxy console.log to wait for "start game called"
    cw.console.log = new Proxy(cw.console.log, {
      apply: (target: any, thisArg: any, argumentsList: any[]) => {
        if (argumentsList[0] === "start game called") {
          setTimeout(() => {
            // Trigger the game start click
            cw.dispatchEvent(
              new PointerEvent("pointerdown", {
                clientX: cw.innerWidth / 2,
                clientY: cw.innerHeight / 2,
              })
            )

            // Hook AudioDOMHandler to catch the "start" sound, then set up drill
            cw.AudioDOMHandler.prototype._Play = new Proxy(cw.AudioDOMHandler.prototype._Play, {
              apply: (target2: any, thisArg2: any, args2: any[]) => {
                if (args2[0]?.originalUrl === "start" && !drillInitializedRef.current) {
                  setTimeout(() => {
                    cw.dispatchEvent(new PointerEvent("pointerup"))
                    // Give the game a moment to settle, then set up the drill
                    setTimeout(() => setupDrill(), 800)
                  }, 2000)
                }
                return false
              }
            })
          }, 500)
        }
        return Reflect.apply(target, thisArg, argumentsList)
      }
    })
  }, [setupDrill])

  // Cleanup timer on unmount or when drill stops
  useEffect(() => {
    if (!isRunning) clearTimer()
  }, [isRunning, clearTimer])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  return (
    <div className="w-full h-full">
      <iframe
        ref={iframeRef}
        src="/play.html"
        className="w-full h-full"
        title="Practice Game"
        id="practice-game-frame"
        onLoad={handleIframeLoad}
      />
    </div>
  )
}
