'use client';

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Basketball } from "@/components/basketball-icon"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createRoom } from "../../lib/rooms"
import React from "react"

export default function CreateRoomPage() {
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    createRoom({
      name: e.currentTarget.courtName.value,
      createdBy: e.currentTarget.playerName.value
    }).then((room) => {
      if (room) {
        window.location.href = `/rooms/${room}`
      } else {
        alert("Failed to create room")
      }
    })
  }

  return (
    <div className="container max-w-md py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="basketball-texture w-10 h-10 flex items-center justify-center shadow-md">
            <Basketball className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Create Room</h1>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/rooms">Back to Rooms</Link>
        </Button>
      </div>

      <div className="basketball-divider w-full mb-8"></div>

      <div className="border rounded-lg overflow-hidden dark:border-muted bg-background">
        <div className="bg-basketball-orange text-white p-4">
          <h2 className="text-xl font-semibold">New Room</h2>
          <p className="text-sm opacity-80">Set up your game</p>
        </div>

        <form className="p-6 space-y-4 bg-accent/30 dark:bg-accent/10" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="courtName">Room Name</Label>
            <Input
              id="courtName"
              required
              placeholder="Enter court name"
              className="border-basketball-orange/50 focus-visible:ring-basketball-orange dark:border-primary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="playerName">Your Name</Label>
            <Input
              id="playerName"
              required
              placeholder="Enter your player name"
              className="border-basketball-orange/50 focus-visible:ring-basketball-orange dark:border-primary/30"
            />
          </div>

          <div className="pt-4">
            <Button className="w-full bg-basketball-orange hover:bg-basketball-darkOrange">Create Room</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

