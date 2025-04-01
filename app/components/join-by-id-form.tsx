"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { checkRoomExists } from "@/lib/rooms"

export function JoinByIdForm() {
  const router = useRouter()
  const [roomId, setRoomId] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!roomId.trim()) return

    setIsJoining(true)
    setError("")

    try {
      const exists = await checkRoomExists(roomId)

      if (!exists) {
        setError("Room not found")
        setIsJoining(false)
        return
      }

      const playerName = localStorage.getItem("playerName")

      if (!playerName) {
        // If no player name is stored, prompt the user
        const name = prompt("Enter your name to join this room:")
        if (name) {
          localStorage.setItem("playerName", name)
          router.push(`/rooms/${roomId}`)
        } else {
          setIsJoining(false)
        }
      } else {
        router.push(`/rooms/${roomId}`)
      }
    } catch (error) {
      console.error("Failed to join room:", error)
      setError("Failed to join room")
      setIsJoining(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="roomId">Room ID</Label>
        <Input
          id="roomId"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isJoining}>
        {isJoining ? "Joining..." : "Join Room"}
      </Button>
    </form>
  )
}

