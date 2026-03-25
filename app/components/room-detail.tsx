"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getRoomById, getRooms, joinRoom, leaveRoom, subscribeToRoomUpdates } from "@/lib/rooms"
import type { Room } from "@/lib/types"
import { GameContainer } from "@/components/game-container"
import { PingIndicator } from "@/components/ping-indicator"
import { Chat } from "@/components/chat"
import { SkinPicker } from "@/components/skin-picker"
import ReconnectingWebSocket from 'reconnecting-websocket'

interface RoomDetailProps {
  roomId: string
  initialRoom: Room
}

export function RoomDetail({ roomId, initialRoom }: RoomDetailProps) {
  const router = useRouter()
  const [room, setRoom] = useState<Room>(initialRoom)
  const [isJoined, setIsJoined] = useState(false)
  const [playerName, setPlayerName] = useState("")
  const [p1conn, setP1Conn] = useState(false);
  const [p2conn, setP2Conn] = useState(false);
  const [p3conn, setP3Conn] = useState(false);
  const [p4conn, setP4Conn] = useState(false);
  const [ ping, setPing ] = useState<number | null>(null);
  const [ status, setStatus ] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [ starting, setStarting ] = useState(false);
  const [ endpoint, setEndpoint ] = useState("");
  const [socket, setSocket] = useState<ReconnectingWebSocket | null>(null);
  const [selectedSkin, setSelectedSkin] = useState('default');
  const [playerSkins, setPlayerSkins] = useState<Record<string, string>>({});
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startGameListenerRef = useRef(false);
  const isJoinedRef = useRef(false);

  useEffect(() => {
    const storedSkin = localStorage.getItem('playerSkin');
    if (storedSkin) setSelectedSkin(storedSkin);
  }, []);

  useEffect(() => {
    // Get player name from localStorage
    const storedName = localStorage.getItem("playerName")
    if (storedName) {
      setPlayerName(storedName)
    } else {
      const name = prompt("Enter your name to join the game:")
      if (name) {
        localStorage.setItem("playerName", name)
        setPlayerName(name)
        location.reload();
      } else {
        alert("You must enter a name to join the game.")
        router.push("/rooms")
        return
      }
    }

    // Join the room
    const joinRoomAsync = async () => {
      if (storedName) {
        try {
          await joinRoom(roomId, storedName)
          setIsJoined(true)
          isJoinedRef.current = true
        } catch (error) {
          console.error("Failed to join room:", error)
        }
      }
    }

    joinRoomAsync()

    // Subscribe to room updates
    const unsubscribe = subscribeToRoomUpdates(roomId, (updatedRoom) => {
      setRoom(updatedRoom)
    })

    // Clean up on unmount
    return () => {
      unsubscribe()
      if (isJoinedRef.current) {
        leaveRoom(roomId, storedName || "").catch((err) => console.error("Error leaving room:", err))
      }
    }
  }, [roomId])

  const maxPlayers = room.mode === '2v2' ? 4 : 2;

  useEffect(() => {
    if (!isJoined) return;
    const int = setInterval(async () => {
      if (room.players.length < maxPlayers) {
        setRoom(await getRoomById(roomId) as Room);
      } else {
        clearInterval(int);
      }
    }, 1000);
    return () => clearInterval(int);
  }, [isJoined, maxPlayers]);

  const handleLeaveRoom = async () => {
    try {
      if (playerName === room.host) {
        const rooms = await getRooms()
        const roomIndex = rooms.findIndex((room) => room.id === roomId)
        if (roomIndex !== -1) {
          return await fetch(`/api/rooms/${roomId}`, {
            method: "DELETE",
          }).then(res => {
            if (!res.ok) {
              throw new Error("Failed to delete room")
            }
            return push("/rooms")
          });
        }
      }
      await leaveRoom(roomId, playerName)
      push("/rooms")
    } catch (error) {
      console.error("Failed to leave room:", error)
    }
  }

  let gameReady = room?.players.length === maxPlayers && room?.started;

  useEffect(() => {
    if (!playerName) return;

    if (!socket) return setSocket(new ReconnectingWebSocket(`/api/lobby/${roomId}`));

    socket.onopen = () => {
      setStatus("connected");
      setPing(0);
      if (room.host === playerName) {
        setP1Conn(true);
      } else {
        setP2Conn(true);
      }
    }

    function ping() {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send("ping");
        let pingStart = Date.now();
        const handle = (e: MessageEvent) => {
          if (e.data.toString() !== "pong") return;
          setPing(Date.now() - pingStart);
          socket.removeEventListener("message", handle);
        }

        socket.addEventListener("message", handle);
      }
    }

    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => ping(), 1000);

    socket.onmessage = (e: MessageEvent) => {
      if ((socket as any)._onmessage) {
        (socket as any)._onmessage(e);
      }
      if (e.data.toString() === "pong") return;
      const data = JSON.parse(e.data.toString());
      if (data.type === "conn" && data.roomId === roomId) {
        const count = data.sockets || 0;
        setP1Conn(count >= 1);
        setP2Conn(count >= 2);
        setP3Conn(count >= 3);
        setP4Conn(count >= 4);
      }
      if (data.type === "skin") {
        setPlayerSkins(prev => ({ ...prev, [data.playerName]: data.skin }));
      }
    }

    socket.onclose = () => {
      setStatus("disconnected");
      setP1Conn(false);
      setP2Conn(false);
    }
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("disconnected");
    }

    if (!startGameListenerRef.current) {
    startGameListenerRef.current = true;
    document.getElementById("start-game")?.addEventListener("click", async () => {
      setStarting(true);

      socket.send(JSON.stringify({
        type: "start-game",
        roomId: roomId,
      }));
      const rooms = await getRooms();
      const roomIndex = rooms.findIndex((room) => room.id === roomId);
      if (roomIndex !== -1) {
        const room = rooms[roomIndex];
        await fetch(`/api/rooms/${roomId}`, {
          method: "PUT",
          body: JSON.stringify({
            id: roomId,
            name: room.name,
            host: room.host,
            players: room.players,
            started: true
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
    });
    } // end startGameListenerRef guard

    socket.addEventListener("message", (event) => {
      if (event.data.toString() === "pong") return;
      if (gameReady) return;
      const data = JSON.parse(event.data);
      if (data.type === "start-game" && data.roomId === roomId) {
        setStarting(false);
        setRoom((prevRoom) => ({
          ...prevRoom,
          started: true,
        }));
        setEndpoint(data.gameSocket);
      }
    });

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [roomId, playerName, socket]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return "Are you sure you want to leave this page?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function push(url: string) {
    if (url === "/rooms") {
      localStorage.removeItem("playerName");
    }
    if (confirm('Are you sure you want to leave this page?')) {
      localStorage.removeItem("playerName");
      window.onbeforeunload = null;
      return router.push(url);
    } else {
      return;
    }
  }

  if (!room) {
    // Fallback in case room is not found
    return (
      <div className="p-4">
        <p className="text-red-500">Room not found. It may have been deleted.</p>
        <Button onClick={() => push("/rooms")}>Back to Rooms</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{room.name}</h1>
          <p className="text-muted-foreground">
            Room ID: <span className="font-mono">{room.id}</span>
          </p>
        </div>
        <Button variant="outline" onClick={handleLeaveRoom}>
          {
            playerName === room.host
              ? "Close Room"
              : "Leave Room"
          }
        </Button>
      </div>

      {gameReady ? (
        <GameContainer roomId={roomId} lobbySocket={socket} players={room.players} ws={endpoint} playerSkins={playerSkins} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for Players {room.mode === '2v2' && <Badge variant="outline" className="ml-2">2v2</Badge>}</CardTitle>
            <CardDescription>
              {room.players.length < maxPlayers
                ? `Waiting for ${maxPlayers - room.players.length} more player${maxPlayers - room.players.length > 1 ? 's' : ''} to join...`
                : `All ${maxPlayers} players are here!`}
            </CardDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">Score to win: {room.scoreMax}</Badge>
              <Badge variant="secondary">Best of: {room.roundGoal}</Badge>
              <Badge variant="secondary">Gravity: {room.gravity ?? 4}</Badge>
              <Badge variant="secondary">
                {room.timeLimit > 0 ? `Time limit: ${room.timeLimit}s` : 'No time limit'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-medium">Players ({room.players.length}/{maxPlayers})</h3>
                {room.mode === '2v2' ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Team 1</h4>
                      <div className="space-y-2">
                        {[0, 1].map((slotIdx) => {
                          const player = room.players[slotIdx];
                          const connStates = [p1conn, p2conn, p3conn, p4conn];
                          const roleLabel = slotIdx % 2 === 0 ? 'Jumper' : 'Arm';
                          return player ? (
                            <div key={slotIdx} className="flex items-center p-2 border rounded-md">
                              <div className={`w-2 h-2 mr-2 rounded-full` + (connStates[slotIdx] ? ' bg-green-500' : ' bg-red-500')}></div>
                              <span>{player}</span>
                              <Badge variant="secondary" className="ml-2 text-xs">{roleLabel}</Badge>
                              {player === room.host && <Badge variant="outline" className="ml-2">Host</Badge>}
                              {player === playerName && <Badge variant="outline" className="ml-2 text-basketball-orange">You</Badge>}
                            </div>
                          ) : (
                            <div key={slotIdx} className="flex items-center p-2 border rounded-md border-dashed">
                              <div className="w-2 h-2 mr-2 bg-gray-300 rounded-full"></div>
                              <span className="text-muted-foreground">Waiting for {roleLabel.toLowerCase()}...</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Team 2</h4>
                      <div className="space-y-2">
                        {[2, 3].map((slotIdx) => {
                          const player = room.players[slotIdx];
                          const connStates = [p1conn, p2conn, p3conn, p4conn];
                          const roleLabel = slotIdx % 2 === 0 ? 'Jumper' : 'Arm';
                          return player ? (
                            <div key={slotIdx} className="flex items-center p-2 border rounded-md">
                              <div className={`w-2 h-2 mr-2 rounded-full` + (connStates[slotIdx] ? ' bg-green-500' : ' bg-red-500')}></div>
                              <span>{player}</span>
                              <Badge variant="secondary" className="ml-2 text-xs">{roleLabel}</Badge>
                              {player === playerName && <Badge variant="outline" className="ml-2 text-basketball-orange">You</Badge>}
                            </div>
                          ) : (
                            <div key={slotIdx} className="flex items-center p-2 border rounded-md border-dashed">
                              <div className="w-2 h-2 mr-2 bg-gray-300 rounded-full"></div>
                              <span className="text-muted-foreground">Waiting for {roleLabel.toLowerCase()}...</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {room.players.map((player, index) => (
                      <div key={index} className="flex items-center p-2 border rounded-md">
                        <div className={`w-2 h-2 mr-2 rounded-full` + ((index === 0 ? p1conn : p2conn) ? ' bg-green-500' : ' bg-red-500')}></div>
                        <span>{player}</span>
                        {player === room.host && (
                          <Badge variant="outline" className="ml-2">
                            Host
                          </Badge>
                        )}
                        { player === playerName && (
                          <Badge variant="outline" className="ml-2 text-basketball-orange">
                            You
                          </Badge>
                        )}
                      </div>
                    ))}
                    {room.players.length < 2 && (
                      <div className="flex items-center p-2 border rounded-md border-dashed">
                        <div className="w-2 h-2 mr-2 bg-gray-300 rounded-full"></div>
                        <span className="text-muted-foreground">Waiting for player...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <SkinPicker
                currentSkin={selectedSkin}
                onSelect={(skin) => {
                  setSelectedSkin(skin);
                  setPlayerSkins(prev => ({ ...prev, [playerName]: skin }));
                  if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'skin', playerName, skin }));
                  }
                }}
              />

              <div className="p-3 text-sm border rounded-md bg-muted/50">
                <p>Share this invite link with a friend to play together:</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 px-2 py-1 font-mono rounded bg-background truncate text-xs">
                    {typeof window !== "undefined" ? `${window.location.origin}/rooms/join/${room.id}` : `/rooms/join/${room.id}`}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/rooms/join/${room.id}`)
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          <div className="px-6 pb-4">
            <Chat socket={socket} playerName={playerName} />
          </div>
          <CardFooter className="justify-between">
            <PingIndicator ping={ping} status={status} />
            {
              playerName === room.host ?
                <Button disabled={(room.players.length < maxPlayers || !p1conn || !p2conn || (room.mode === '2v2' && (!p3conn || !p4conn))) || starting} id="start-game">Start Game</Button> :
                <Button disabled className="opacity-50 cursor-not-allowed">
                  Waiting for Host...
                </Button>
            }
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

