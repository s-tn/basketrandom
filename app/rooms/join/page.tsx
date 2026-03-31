"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function JoinByCodePage() {
  const router = useRouter()
  const [code, setCode] = useState("")

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim()) {
      router.push(`/rooms/join/${code.trim()}`)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Join by Code</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter a room code to join</p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Room Code</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter room code"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={!code.trim()}>
                Join Room
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
