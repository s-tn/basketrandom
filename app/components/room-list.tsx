"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getRooms } from "@/lib/rooms"
import type { Room } from "@/lib/types"

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

  const handleJoinRoom = (roomId: string) => {
    const playerName = localStorage.getItem("playerName")

    if (!playerName) {
      // If no player name is stored, prompt the user
      const name = prompt("Enter your name to join this room:")
      if (name) {
        localStorage.setItem("playerName", name)
        router.push(`/rooms/${roomId}`)
      }
    } else {
      router.push(`/rooms/${roomId}`)
    }
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
      {rooms.map((room) => (
        <Card key={room.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{room.name}</CardTitle>
              <Badge variant={room.players.length === 1 ? "outline" : "secondary"}>
                {room.players.length}/2 Players
              </Badge>
            </div>
            <CardDescription>Created by {room.createdBy}</CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <p className="text-sm text-muted-foreground">
              Room ID: <span className="font-mono">{room.id}</span>
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => handleJoinRoom(room.id)} className="w-full" disabled={room.players.length >= 2}>
              {room.players.length >= 2 ? "Room Full" : "Join Room"}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

