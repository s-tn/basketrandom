"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PingIndicator } from "@/components/ping-indicator"
import { Button } from "./ui/button"
import { ArrowBigUp } from "lucide-react"

interface GameContainerProps {
  roomId: string
  players: string[]
  ws: string
}

export function GameContainer({ roomId, players, ws }: GameContainerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("Loading game...")
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number>(-1);
  const [w, setW] = useState(false);
  const [upArrow, setUpArrow] = useState(false);
  const [ping, setPing] = useState(0);
  const [pingStatus, setPingStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  useEffect(() => {
    // Simulate game loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
    if (iframe) {
      const cw: any = iframe.contentWindow;
      cw.addEventListener("message", async (event: MessageEvent) => {
        if (event.data.type === 'update') {
          //setMessage(event.data.data);
        }
        if (event.data.type === 'ready') {
          setMessage("Waiting on server...");
        }
        if (event.data.type === 'loaded') {
          setMessage("Waiting for start...")
          setPingStatus("connected");
        }
        if (event.data.type === 'ping') {
          setPing(event.data.data);
        }
        if (event.data.type === 'start') {
          setMessage("");

          for (let i = 1; i < 4; i ++) {
            setCountdown(3 - i);
            await new Promise((resolve) => setTimeout(resolve, 1000)); 
          }

          setCountdown(-1);

          cw.unpause();
        }
      });
      cw.addEventListener('basket-key', (event: CustomEvent<{key: string, type: string}>) => {
        const { key, type } = event.detail;

        if (type === 'keyup') {
          if (key === 'ArrowUp') {
            setUpArrow(false);
          }
          if (key === 'w') {
            setW(false);
          }
        }
        if (type === 'keydown') {
          if (key === 'ArrowUp') {
            setUpArrow(true);
          }
          if (key === 'w') {
            setW(true);
          }
        }
      });
      cw.addEventListener("ready", (event: MessageEvent) => {
        cw.init(ws);
      });
    }
  }, [isLoading, ws])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-lg">Connecting to Server...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {players.map((player, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>{player}</span>
            </div>
          ))}
        </div>
        <PingIndicator status={pingStatus} ping={ping} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-muted py-4">
          <CardTitle className="flex items-center justify-between">
            <span>Game Started</span>
            <div className="flex flex-row items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={"border border-input p-2 rounded-sm h-full transition duration-100 ease-in-out" + (w ? " bg-primary" : "")}>
                  <ArrowBigUp className="text-white" />
                </div>
                <div className={"border border-input p-2 rounded-sm h-full transition duration-100 ease-in-out" + (upArrow ? " bg-primary" : "")}>
                  <ArrowBigUp className="text-white" />
                </div>
              </div>
              <span className="text-sm font-normal">Room: {roomId}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 relative">
          {
            message &&
            (<>
              <div className="absolute inset-0 bg-black opacity-85"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {
                  message !== "Waiting for start..." && <div className="w-12 h-12 border-4 border-t-primary rounded-full animate-spin"></div>
                }
                <span className="absolute top-16 text-lg text-white">{message}</span>
                {
                  message === "Waiting for start..." ? (
                    <Button 
                      className={"py-6 px-10 text-lg"}
                      disabled={ready}
                      onClick={() => {
                        setReady(true);
                        const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
                        if (iframe) {
                          const cw: any = iframe.contentWindow;
                          cw.ready();
                        }
                      }}>
                        Ready
                      </Button>
                  ) : null
                }
              </div>
            </>)
          }
          {
            <div className={"absolute inset-0 bg-black opacity-85 flex items-center justify-center" + ((countdown + 1) ? "" : " hidden")}>
              <span className="text-white text-4xl">{countdown + 1}</span>
            </div>
          }
          {/* Game iframe */}
          <div className="flex items-center justify-center bg-black aspect-video">
            <iframe src="/game.html" className="w-full h-full" title="Game" id="game-frame"></iframe>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

