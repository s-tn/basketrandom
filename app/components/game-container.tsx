"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PingIndicator } from "@/components/ping-indicator"
import { Button } from "./ui/button"
import { ArrowBigUp, Fullscreen, MessageSquare, Pencil, Scissors } from "lucide-react"
import { ClipToast } from "./clip-toast"
import { Separator } from "@radix-ui/react-dropdown-menu"
import GameResult from "./game-result"
import ReconnectingWebSocket from "reconnecting-websocket"
import { Chat } from "./chat"

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
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [clipBlob, setClipBlob] = useState<Blob | null>(null);
  const [clipAuto, setClipAuto] = useState(false);
  const [drawActive, setDrawActive] = useState(false);
  const [showSidePick, setShowSidePick] = useState(false);
  const [mySide, setMySide] = useState<string | null>(null);
  const [coinFlipWinner, setCoinFlipWinner] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const playerNameRef = useRef<string>("");
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);

  const gameLoadedRef = useRef<{ promise: Promise<void>; resolve: () => void }>({ promise: Promise.resolve(), resolve: () => {} });

  useEffect(() => {
    let resolveRef: () => void = () => {};
    gameLoadedRef.current = {
      promise: new Promise<void>(r => { resolveRef = r; }),
      resolve: () => resolveRef(),
    };
    playerNameRef.current = localStorage.getItem("playerName") || players[0] || "";
  }, []);

  useEffect(() => {
    // Simulate game loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (lobbySocket) {
      (lobbySocket as any)._onmessage = (event: MessageEvent) => {
        if (event.data === "pong") return;
        const data = JSON.parse(event.data);
        if (data.type === 'rematch-request') {
          setRematchPending(true);
        }
        if (data.type === 'rematch-room') {
          window.location.href = `/rooms/${data.roomId}`;
        }
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
    setRounds(prevRounds => {
      const index = prevRounds.findIndex(round => round[3] === true);
      if (index === -1) return prevRounds;
      if (prevRounds[index][1] === score[0] && prevRounds[index][2] === score[1]) return prevRounds;
      const newRounds = prevRounds.map(r => [...r] as [null | number, number, number, boolean?]);
      newRounds[index][1] = score[0];
      newRounds[index][2] = score[1];
      return newRounds;
    });
  }, [score]);

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
        if (event.data.type === 'clip') {
          setClipBlob(event.data.blob);
          setClipAuto(event.data.auto);
          setTimeout(() => setClipBlob(null), 8000);
        }
        if (event.data.type === 'drawActive') {
          setDrawActive(event.data.active);
        }
        if (event.data.type === 'score') {
          setScore(event.data.data);
        }
        if (event.data.type === 'ping') {
          if (pingStatus !== "connected") {
            setPingStatus("connected");
          }
          setScore(event.data.scores);
          return setPing(event.data.data);
        }

        if (event.data.type === 'ready') {
          gameLoadedRef.current.resolve();
          return setMessage("Waiting on server...");
        }

        if (event.data.type === 'error') {
          setPingStatus("disconnected");
          return setMessage(event.data.data);
        }

        await gameLoadedRef.current.promise;

        if (event.data.type === 'coinflip') {
          if (event.data.phase === 'start') {
            setMessage("");
          } else {
            // Coin flip animation ended
            setCoinFlipWinner(event.data.winnerName);
            if (event.data.youWon) {
              // Show side pick UI
              setShowSidePick(true);
              setMessage("");
            } else {
              setMessage(`${event.data.winnerName} is picking a side...`);
            }
          }
        }
        if (event.data.type === 'side-assigned') {
          setMySide(event.data.side);
          setShowSidePick(false);
          setMessage(event.data.round === 0
            ? `You are on the ${event.data.side}!`
            : `Sides swapped! You are now on the ${event.data.side}!`);
          setTimeout(() => setMessage(""), 2000);
        }
        if (event.data.type === 'role-assigned') {
          const roleDisplay = event.data.role.replace('team', 'Team ').replace('-', ' ');
          setPlayerRole(roleDisplay);
          setMessage(`You are: ${roleDisplay}`);
          setTimeout(() => setMessage(""), 3000);
        }

        if (event.data.type === 'loaded') {
          setReady(false);
          setMessage("Waiting for start...")
          setPingStatus("connected");
        }
        if (event.data.type === 'start') {
          setMessage("");

          for (let i = 1; i < 4; i ++) {
            setCountdown(3 - i);
            const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
            if (3 - i > 0) {
              iframe?.contentWindow?.postMessage({ type: 'countdown-beep' }, '*');
            } else {
              iframe?.contentWindow?.postMessage({ type: 'countdown-go' }, '*');
            }
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
              <button
                onClick={() => {
                    const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
                    iframe?.contentWindow?.postMessage({ type: 'manualClip' }, '*');
                }}
                className="border border-input cursor-pointer p-2 rounded-sm h-full transition duration-100 ease-in-out hover:bg-primary/50"
                title="Clip last 10s"
              >
                <Scissors className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                    const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
                    iframe?.contentWindow?.postMessage({ type: 'toggleDraw' }, '*');
                }}
                className={"border border-input cursor-pointer p-2 rounded-sm h-full transition duration-100 ease-in-out " + (drawActive ? "bg-primary" : "hover:bg-primary/50")}
                title="Toggle drawing overlay"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChatOpen(prev => !prev)}
                className={"border border-input cursor-pointer p-2 rounded-sm h-full transition duration-100 ease-in-out " + (chatOpen ? "bg-primary" : "hover:bg-primary/50")}
                title="Toggle chat"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
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
            showSidePick &&
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20 gap-4">
              <span className="text-white text-xl font-semibold">You won the coin flip!</span>
              <span className="text-white/70 text-sm">Pick your starting side:</span>
              <div className="flex gap-6">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6"
                  onClick={() => {
                    const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
                    iframe?.contentWindow?.postMessage({ type: 'side-pick', side: 'left' }, '*');
                    setShowSidePick(false);
                    setMessage("Starting...");
                  }}
                >
                  ← Left
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6"
                  onClick={() => {
                    const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
                    iframe?.contentWindow?.postMessage({ type: 'side-pick', side: 'right' }, '*');
                    setShowSidePick(false);
                    setMessage("Starting...");
                  }}
                >
                  Right →
                </Button>
              </div>
              <span className="text-white/50 text-xs mt-2">Sides alternate each round</span>
            </div>
          }
          {
            over &&
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-6 z-10">
              <span className="text-white text-4xl">{winner === 0 ? players[0] : players[1]} wins!</span>
              {rematchPending && !rematchRequested ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="text-white text-lg">Opponent wants rematch!</span>
                  <div className="flex gap-4">
                    <Button
                      size="lg"
                      onClick={() => {
                        lobbySocket?.send(JSON.stringify({ type: 'rematch-accept' }));
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => {
                        setRematchPending(false);
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ) : rematchRequested ? (
                <span className="text-white/70 text-base">Waiting for opponent...</span>
              ) : (
                <div className="flex gap-4">
                  <Button
                    size="lg"
                    onClick={() => {
                      setRematchRequested(true);
                      lobbySocket?.send(JSON.stringify({ type: 'rematch-request' }));
                    }}
                  >
                    Rematch
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      window.location.href = '/rooms';
                    }}
                  >
                    Back to Lobby
                  </Button>
                </div>
              )}
            </div>
          }
          {/* Game iframe */}
          <div className="flex items-center justify-center bg-black aspect-video">
            <iframe src={`/game.html#${btoa(ws)}`} className="w-full h-full" title="Game" id="game-frame"></iframe>
          </div>
          {/* In-game chat overlay */}
          {chatOpen && lobbySocket && (
            <div className="absolute bottom-3 left-3 z-30">
              <Chat socket={lobbySocket} playerName={playerNameRef.current} compact />
            </div>
          )}
        </CardContent>
      </Card>
      <ClipToast
          blob={clipBlob}
          auto={clipAuto}
          roomId={roomId}
          playerName={players[0] || ''}
          onDismiss={() => setClipBlob(null)}
      />
    </div>
  )
}

