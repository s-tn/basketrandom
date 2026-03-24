"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function JoinRoomPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [roomName, setRoomName] = useState("")
  const [roomHost, setRoomHost] = useState("")
  const [roomLoading, setRoomLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/rooms/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError("Room not found or no longer available.")
        } else {
          setRoomName(data.name)
          setRoomHost(data.host)
          if (data.opponent) {
            setError("This room is already full.")
          }
        }
        setRoomLoading(false)
      })
      .catch(() => {
        setError("Room not found or no longer available.")
        setRoomLoading(false)
      })

    const stored = localStorage.getItem("playerName")
    if (stored) setName(stored)
  }, [id])

  async function handleJoin() {
    if (!name.trim()) return
    setLoading(true)
    localStorage.setItem("playerName", name.trim())
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponent: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to join room.")
        setLoading(false)
        return
      }
      router.push(`/rooms/${id}`)
    } catch {
      setError("Failed to join room.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {roomLoading ? "Loading room..." : error ? "Cannot Join Room" : `Join ${roomName}`}
          </CardTitle>
          {!roomLoading && !error && roomHost && (
            <CardDescription>Hosted by {roomHost}</CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : roomLoading ? (
            <p className="text-sm text-muted-foreground">Fetching room details...</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="player-name">Your name</Label>
                <Input
                  id="player-name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => router.push("/rooms")} disabled={loading}>
            Back to Rooms
          </Button>
          {!error && !roomLoading && (
            <Button onClick={handleJoin} disabled={loading || !name.trim()}>
              {loading ? "Joining..." : "Join Game"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
