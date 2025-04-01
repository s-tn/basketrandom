"use client"
import { Button } from "@/components/ui/button"
import { Basketball } from "@/components/basketball-icon"
import React from "react"

export default function Home() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-screen py-12 space-y-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="basketball-texture w-20 h-20 flex items-center justify-center animate-bounce-slow shadow-lg">
            <Basketball className="w-16 h-16 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-center">
          Basket <span className="text-primary">Random</span>
        </h1>
      </div>

      {/* <div className="basketball-divider w-64 my-4"></div>

      <p className="text-xl text-center text-muted-foreground max-w-md">
        Create or join a court to start playing with other ballers
      </p> */}

      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          size="lg"
          variant="outline"
          className="px-8 border-basketball-orange text-basketball-orange hover:bg-accent hover:text-basketball-darkOrange dark:text-primary dark:border-primary"
          onClick={() => (window.location.href = "/rooms/create")}
        >
          Create Room
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="px-8 border-basketball-orange text-basketball-orange hover:bg-accent hover:text-basketball-darkOrange dark:text-primary dark:border-primary"
          onClick={() => (window.location.href = "/rooms")}
        >
          Join Room
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="px-8 border-basketball-orange text-basketball-orange hover:bg-accent hover:text-basketball-darkOrange dark:text-primary dark:border-primary"
          onClick={() => (window.location.href = "/rooms")}
        >
          Play Offline
        </Button>
      </div>
    </div>
  )
}

