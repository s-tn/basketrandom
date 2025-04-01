"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getRoomById, getRooms, joinRoom, leaveRoom, subscribeToRoomUpdates } from "@/lib/rooms"
import type { Room } from "@/lib/types"
import { GameContainer } from "@/components/game-container"
import { PingIndicator } from "@/components/ping-indicator"

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
  const [ ping, setPing ] = useState<number | null>(null);
  const [ status, setStatus ] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [ starting, setStarting ] = useState(false);
  const [ endpoint, setEndpoint ] = useState("");

  useEffect(() => {
    // Get player name from localStorage
    const storedName = localStorage.getItem("playerName")
    if (storedName) {
      setPlayerName(storedName)
    }

    // Join the room
    const joinRoomAsync = async () => {
      if (storedName) {
        try {
          await joinRoom(roomId, storedName)
          setIsJoined(true)
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
      if (isJoined) {
        leaveRoom(roomId, storedName || "").catch((err) => console.error("Error leaving room:", err))
      }
    }
  }, [roomId])

  useEffect(() => {
    if (isJoined) {
      const int = setInterval(async () => {
        console.log(room.players.length);
        if (room.players.length < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000))

          setRoom(await getRoomById(roomId) as Room);
        } else {
          clearInterval(int)
        }
      }, 1000);
    }
  }, [isJoined]);

  const handleLeaveRoom = async () => {
    try {
      if (playerName === room.createdBy) {
        const rooms = await getRooms()
        const roomIndex = rooms.findIndex((room) => room.id === roomId)
        if (roomIndex !== -1) {
          return await fetch(`/api/rooms/${roomId}`, {
            method: "DELETE",
          }).then(res => {
            if (!res.ok) {
              throw new Error("Failed to delete room")
            }
            return router.push("/rooms")
          });
        }
      }
      await leaveRoom(roomId, playerName)
      push("/rooms")
    } catch (error) {
      console.error("Failed to leave room:", error)
    }
  }

  let gameReady = room.players.length === 2 && room.started;

  useEffect(() => {
    if (!playerName) return;

    const socket = new WebSocket(`/api/lobby/${roomId}`);

    socket.onopen = () => {
      setStatus("connected");
      setPing(0);
      if (room.createdBy === playerName) {
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

    setInterval(() => ping(), 1000);

    socket.onmessage = (e: MessageEvent) => {
      if (e.data.toString() === "pong") return;
      const data = JSON.parse(e.data.toString());
      if (data.type === "conn" && data.roomId === roomId) {
        if (data.sockets === 2) {
          setP1Conn(true);
          setP2Conn(true);
        } else if (data.sockets === 1) {
          if (room.createdBy === playerName) {
            setP1Conn(true);
          } else {
            setP2Conn(true);
          }
        } else {
          setP1Conn(false);
          setP2Conn(false);
        }
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
            createdBy: room.createdBy,
            players: room.players,
            started: true
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
    });

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
  }, [roomId, playerName]);

  useEffect(() => {
    window.onbeforeunload = function () {
      return "Are you sure you want to leave this page?";
    }
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
            playerName === room.createdBy
              ? "Close Room"
              : "Leave Room"
          }
        </Button>
      </div>

      {gameReady ? (
        <GameContainer roomId={roomId} players={room.players} ws={endpoint} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for Players</CardTitle>
            <CardDescription>
              {room.players.length === 1
                ? "Waiting for another player to join..."
                : "Game will start when two players join"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-medium">Players ({room.players.length}/2)</h3>
                <div className="space-y-2">
                  {room.players.map((player, index) => (
                    <div key={index} className="flex items-center p-2 border rounded-md">
                      <div className={`w-2 h-2 mr-2 rounded-full` + ((index === 0 ? p1conn : p2conn) ? ' bg-green-500' : ' bg-red-500')}></div>
                      <span>{player}</span>
                      {player === room.createdBy && (
                        <Badge variant="outline" className="ml-2">
                          Host
                        </Badge>
                      )}
                      { player === playerName && (
                        // Highlight the current player
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
              </div>

              <div className="p-3 text-sm border rounded-md bg-muted/50">
                <p>Share this room ID with a friend to play together:</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="px-2 py-1 font-mono rounded bg-background">{room.id}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(room.id)
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <PingIndicator ping={ping} status={status} />
            {
              playerName === room.createdBy ?
                <Button disabled={room.players.length < 2 || starting} id="start-game">Start Game</Button> :
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

