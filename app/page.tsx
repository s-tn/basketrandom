"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const SECTIONS = [
  {
    title: "Play",
    description: "Jump into a game",
    items: [
      { href: "/rooms/create", label: "Create Room", desc: "Start a new match", icon: "➕", primary: true },
      { href: "/rooms", label: "Join Room", desc: "Find open games", icon: "🚪", primary: true },
      { href: "/ranked", label: "Ranked", desc: "ELO matchmaking", icon: "⚔️", primary: true },
      { href: "/offline", label: "Play Offline", desc: "vs AI locally", icon: "🎮" },
      { href: "/practice", label: "Practice", desc: "Training drills", icon: "🏋️" },
    ],
  },
  {
    title: "Compete",
    description: "Tournaments & rankings",
    items: [
      { href: "/tournaments", label: "Tournaments", desc: "Bracket & round-robin", icon: "🏆" },
      { href: "/seasons", label: "Seasons", desc: "Weekly leaderboards", icon: "📅" },
      { href: "/stats", label: "Stats", desc: "Player leaderboard", icon: "📊" },
      { href: "/achievements", label: "Achievements", desc: "Unlock badges", icon: "🎖️" },
    ],
  },
  {
    title: "Social",
    description: "Connect & share",
    items: [
      { href: "/friends", label: "Friends", desc: "Online status & invite", icon: "👥" },
      { href: "/clips", label: "Clips", desc: "Highlight gallery", icon: "🎬" },
      { href: "/replays", label: "Replays", desc: "Watch past matches", icon: "⏪" },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/strategy", label: "Strategy Board", desc: "Draw plays on court", icon: "✏️" },
    ],
  },
]

export default function Home() {
  return (
    <div className="container max-w-5xl mx-auto py-10 px-4 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-bold tracking-tight">
          Basket <span className="text-primary">Random</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Real-time multiplayer basketball
        </p>
      </div>

      {/* Quick play buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/rooms/create">
          <Card className="hover:border-primary transition cursor-pointer bg-primary text-primary-foreground">
            <CardContent className="py-4 px-6 text-center">
              <p className="font-semibold text-lg">Play Now</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/ranked">
          <Card className="hover:border-primary transition cursor-pointer">
            <CardContent className="py-4 px-6 text-center">
              <p className="font-semibold text-lg">Ranked Match</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/rooms">
          <Card className="hover:border-primary transition cursor-pointer">
            <CardContent className="py-4 px-6 text-center">
              <p className="font-semibold text-lg">Browse Rooms</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">{section.title}</h2>
            {section.description && (
              <p className="text-sm text-muted-foreground">{section.description}</p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {section.items.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className={`hover:border-primary transition cursor-pointer h-full ${
                  (item as any).primary ? "border-primary/30" : ""
                }`}>
                  <CardContent className="py-4 px-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.icon}</span>
                      <p className="font-medium text-sm">{item.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
