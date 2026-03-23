"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function CreateTournamentPage() {
  const [name, setName] = useState("")
  const [format, setFormat] = useState("bracket")
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [streamed, setStreamed] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    setLoading(true)
    setError("")

    const playerName =
      typeof window !== "undefined"
        ? localStorage.getItem("playerName") || "Anonymous"
        : "Anonymous"

    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          format,
          maxPlayers,
          streamed,
          private: isPrivate,
          createdBy: playerName,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || "Failed to create tournament")
        setLoading(false)
        return
      }

      const data = await res.json()
      window.location.href = `/tournaments/${data.id}`
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="container py-8 max-w-lg mx-auto">
      <div className="mb-6">
        <Button
          variant="outline"
          className="border-basketball-orange text-basketball-orange hover:bg-accent hover:text-basketball-darkOrange dark:text-primary dark:border-primary"
          onClick={() => (window.location.href = "/tournaments")}
        >
          Back to Tournaments
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create Tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Tournament name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bracket">Bracket (Single Elimination)</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxPlayers">Max Players</Label>
              <Input
                id="maxPlayers"
                type="number"
                min={2}
                max={64}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="streamed"
                checked={streamed}
                onCheckedChange={(v) => setStreamed(Boolean(v))}
              />
              <Label htmlFor="streamed" className="cursor-pointer">
                Streamed (matches are public games)
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="private"
                checked={isPrivate}
                onCheckedChange={(v) => setIsPrivate(Boolean(v))}
              />
              <Label htmlFor="private" className="cursor-pointer">
                Private (invite-only)
              </Label>
            </div>

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Creating..." : "Create Tournament"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
