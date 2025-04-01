"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createRoom } from "@/lib/rooms"

export function CreateRoomForm() {
  const router = useRouter()
  const [roomName, setRoomName] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!roomName.trim() || !playerName.trim()) return

    setIsCreating(true)

    try {
      const roomId = await createRoom({
        name: roomName,
        createdBy: playerName,
      })

      // Store player name in localStorage for persistence
      localStorage.setItem("playerName", playerName)

      // Navigate to the room
      router.push(`/rooms/${roomId}`)
    } catch (error) {
      console.error("Failed to create room:", error)
      setIsCreating(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Create a New Room</CardTitle>
          <CardDescription>Create a room and wait for another player to join</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roomName">Room Name</Label>
            <Input
              id="roomName"
              placeholder="Enter room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="playerName">Your Name</Label>
            <Input
              id="playerName"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Room"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

