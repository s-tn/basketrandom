"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getRooms } from "@/app/lib/rooms"
import type { Room } from "@/app/lib/types"

const DEFAULTS = { scoreMax: 10, roundGoal: 3, gravity: 4, timeLimit: 0, tournament: false };

function getMaxPlayers(mode: string) { return mode === '2v2' ? 4 : 2; }

function getRoomStatus(room: Room): 'waiting' | 'playing' | 'finished' {
  if (room.winner !== null) return 'finished';
  if (room.started) return 'playing';
  return 'waiting';
}

function hasCustomRules(room: Room) {
  return (
    room.scoreMax !== DEFAULTS.scoreMax ||
    room.roundGoal !== DEFAULTS.roundGoal ||
    room.gravity !== DEFAULTS.gravity ||
    room.timeLimit !== DEFAULTS.timeLimit ||
    room.tournament !== DEFAULTS.tournament
  );
}

export function RoomList() {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomsData = await getRooms()
        setRooms(roomsData)
      } catch (error) {
        console.error("Failed to fetch rooms:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRooms()

    // Set up polling to refresh rooms
    const intervalId = setInterval(fetchRooms, 5000)

    return () => clearInterval(intervalId)
  }, [])

  const handleJoinRoom = (roomId: string, host: string) => {
    const playerName = localStorage.getItem("playerName")
    const name = playerName || prompt("Enter your name to join this room:")
    if (!name) return;
    if (name === host) { alert("You cannot join your own room as the creator."); return; }
    if (!playerName) localStorage.setItem("playerName", name)
    router.push(`/rooms/${roomId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading rooms...</div>
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <p className="mb-4 text-lg text-muted-foreground">No rooms available</p>
          <Button asChild>
            <a href="/rooms/create">Create a Room</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {rooms.map((room) => {
        const maxPlayers = getMaxPlayers(room.mode);
        const status = getRoomStatus(room);
        const custom = hasCustomRules(room);

        const statusLabel = status === 'waiting' ? 'Waiting' : status === 'playing' ? 'In Progress' : 'Finished';
        const statusVariant: 'default' | 'secondary' | 'outline' =
          status === 'waiting' ? 'default' : status === 'playing' ? 'secondary' : 'outline';

        return (
          <Card key={room.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle>{room.name}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{room.mode.toUpperCase()}</Badge>
                  <Badge variant={statusVariant}>{statusLabel}</Badge>
                  <Badge variant={room.players.length >= maxPlayers ? "secondary" : "outline"}>
                    {room.players.length}/{maxPlayers} Players
                  </Badge>
                  {custom && <Badge variant="outline">Custom rules</Badge>}
                  {room.tournament && <Badge variant="outline">Tournament</Badge>}
                </div>
              </div>
              <CardDescription>Host: {room.host}</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm text-muted-foreground">
                Room ID: <span className="font-mono">{room.id}</span>
              </p>
              {custom && (
                <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                  {room.scoreMax !== DEFAULTS.scoreMax && <span className="mr-3">Score limit: {room.scoreMax}</span>}
                  {room.roundGoal !== DEFAULTS.roundGoal && <span className="mr-3">Rounds: {room.roundGoal}</span>}
                  {room.gravity !== DEFAULTS.gravity && <span className="mr-3">Gravity: {room.gravity}</span>}
                  {room.timeLimit !== DEFAULTS.timeLimit && <span className="mr-3">Time: {room.timeLimit}s</span>}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              {status === 'waiting' && (
                <Button
                  onClick={() => handleJoinRoom(room.id, room.host)}
                  className="flex-1"
                  disabled={room.players.length >= maxPlayers}
                >
                  {room.players.length >= maxPlayers ? "Room Full" : "Join Room"}
                </Button>
              )}
              {status === 'playing' && (
                <Button variant="outline" asChild className="flex-1">
                  <Link href={`/rooms/${room.id}/watch`}>Watch</Link>
                </Button>
              )}
              {status === 'finished' && (
                <span className="text-sm text-muted-foreground">Game finished</span>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  )
}

