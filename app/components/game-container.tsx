"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PingIndicator } from "@/components/ping-indicator"
import { Button } from "./ui/button"
import { ArrowBigUp, Fullscreen } from "lucide-react"
import { Separator } from "@radix-ui/react-dropdown-menu"
import GameResult from "./game-result"
import ReconnectingWebSocket from "reconnecting-websocket"

interface GameContainerProps {
  roomId: string
  players: string[]
  ws: string
  lobbySocket?: ReconnectingWebSocket
}

export function GameContainer({ roomId, players, ws, lobbySocket }: GameContainerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("Loading game...")
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number>(-1);
  const [w, setW] = useState(false);
  const [upArrow, setUpArrow] = useState(false);
  const [ping, setPing] = useState(0);
  const [pingStatus, setPingStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [rounds, setRounds] = useState<[null | number, number, number, boolean?][]>([]);
  const [over, setOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]);

  let res: any = () => {};
  const gameLoaded = new Promise((resolve) => {
    res = resolve;
  });

  useEffect(() => {
    // Simulate game loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (lobbySocket) {
      console.log('eeeee')
      lobbySocket._onmessage = (event) => {
        if (event.data === "pong") return;
        const data = JSON.parse(event.data);
        if (data.type === "room-info") {
          const rounds = JSON.parse(data.data.rounds);

          const maxRounds = data.data.roundGoal * 2 - 1;
          const newRounds: [null | number, number, number, boolean?][] = Array.from({ length: maxRounds }, (_, i) => [null, 0, 0]);
          for (let i = 0; i < rounds.length; i++) {
            newRounds[i] = rounds[i];
          }
          if (data.data.winner === null) {
            newRounds[rounds.length] = [null, 0, 0, true];
          } else {
            setWinner(parseInt(data.data.winner));
            setOver(true);
          }
          setRounds(newRounds);
        }
      };
      lobbySocket.send(JSON.stringify({
        type: "room-info",
        roomId,
      }));
    }
  }, [lobbySocket]);

  useEffect(() => {
    const index = rounds.findIndex(round => round[3] === true && (round[1] !== score[0] || round[2] !== score[1]));
    if (index !== -1) {
      const newRounds = [...rounds];
      newRounds[index][1] = score[0];
      newRounds[index][2] = score[1];
      setRounds(newRounds);
    }
}, [score, rounds]);

  useEffect(() => {
    const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
    if (iframe) {
      const cw: any = iframe.contentWindow;
      cw.addEventListener("message", async (event: MessageEvent) => {
        if (event.data.type === 'update') {
          //setMessage(event.data.data);
        }
        if (event.data.type === 'newround') {
          if (lobbySocket) {
            lobbySocket.send(JSON.stringify({
              type: "room-info",
              roomId,
            }));
          }
          setMessage("New round starting...");
          setReady(false);
          setPingStatus("connected");
        }
        if (event.data.type === 'end') {
          setMessage("Game Over");
          setOver(true);
          setWinner(event.data.winner);
          setPingStatus("disconnected");
          if (lobbySocket) {
            lobbySocket.send(JSON.stringify({
              type: "room-info",
              roomId,
            }));
          }
        }
        if (event.data.type === 'ping') {
          if (pingStatus !== "connected") {
            setPingStatus("connected");
          }
          setScore(event.data.scores);
          return setPing(event.data.data);
        }

        if (event.data.type === 'ready') {
          res();
          return setMessage("Waiting on server...");
        }

        if (event.data.type === 'error') {
          setPingStatus("disconnected");
          return setMessage(event.data.data);
        }

        await gameLoaded;

        if (event.data.type === 'loaded') {
          setReady(false);
          setMessage("Waiting for start...")
          setPingStatus("connected");
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
    }
  }, [isLoading, ws])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.getElementById('gamecont')!.requestFullscreen();
    }
  }

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
      <Card className="overflow-hidden">
        <CardContent className="flex flex-row items-center justify-center p-0 gap-1">
          <div className="flex flex-row items-center justify-center flex-1 flex-wrap">
            {
              rounds.map((round, index) => {
                return (
                  <GameResult completed={round[0] !== null || round[3]} winner={round[0]} score={[round[1], round[2]]} players={players.slice(0, 2)} key={index} />
                )
              })
            }
          </div>
          <div className="flex flex-row flex-wrap items-center justify-center items-center justify-space py-2 px-4 gap-4 flex-1/4 h-full">
            <div className="flex flex-col">
              <span className="text-sm font-normal">{players[0]}:</span>
              <div className="flex flex-row items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-primary/80 rounded-full"></div>
                <div className="text-2xl font-bold">{rounds.filter(round => round[0] === 0).length}</div>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-normal">{players[1]}:</span>
              <div className="flex flex-row items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-foreground/50 rounded-full"></div>
                <div className="text-2xl font-bold">{rounds.filter(round => round[0] === 1).length}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden" id="gamecont">
        <CardHeader className="bg-muted py-4">
          <CardTitle className="flex items-center justify-between">
            <span>Game Started</span>
            <div className="flex flex-row justify-start items-center font-normal text-sm ml-16 mr-auto gap-8">
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
              <div onClick={toggleFullscreen} className={"border border-input cursor-pointer p-2 rounded-sm h-full transition duration-100 ease-in-out hover:bg-primary/50"}>
                <Fullscreen className="text-white" />
              </div>
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
                  (message !== "Waiting for start..." && message !== "New round starting...") && <div className="w-12 h-12 border-4 border-t-primary rounded-full animate-spin"></div>
                }
                <span className="absolute top-16 text-lg text-white">{message}</span>
                {
                  (message === "Waiting for start..." || message === "New round starting...") ? (
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
          {
            over &&
            <div className="absolute inset-0 bg-black opacity-85 flex items-center justify-center">
              <span className="text-white text-4xl">{winner === 0 ? players[0] : players[1]} wins!</span>
            </div>
          }
          {/* Game iframe */}
          <div className="flex items-center justify-center bg-black aspect-video">
            <iframe src={`/game.html#${btoa(ws)}`} className="w-full h-full" title="Game" id="game-frame"></iframe>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

