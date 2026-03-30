"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

export default function Home() {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => { setName(localStorage.getItem("playerName")) }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">

      {/* ─── Hero ─── */}
      <section className="text-center space-y-5 hero-glow">
        <div className="inline-flex items-center gap-2 tag mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
        <h1 className="text-6xl sm:text-7xl font-bold tracking-tighter leading-[0.9]">
          BASKET<br />
          <span className="text-primary">RANDOM</span>
        </h1>
        <p className="text-muted-foreground text-base max-w-sm mx-auto">
          Real-time multiplayer basketball. Create a room, invite a friend, play.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/rooms/create">
            <button className="bg-primary text-primary-foreground font-semibold text-sm px-6 py-2.5 rounded-lg hover:brightness-110 transition-all shadow-lg shadow-primary/20">
              Play Now
            </button>
          </Link>
          <Link href="/rooms">
            <button className="border border-border text-foreground font-medium text-sm px-6 py-2.5 rounded-lg hover:bg-muted transition-all">
              Browse Rooms
            </button>
          </Link>
        </div>
      </section>

      <div className="court-line" />

      {/* ─── Quick Actions ─── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: "/ranked", label: "RANKED", sub: "ELO matchmaking", bg: "bg-gradient-to-br from-orange-600 to-red-600" },
          { href: "/tournaments", label: "TOURNEYS", sub: "Brackets & round-robin", bg: "bg-gradient-to-br from-violet-600 to-indigo-600" },
          { href: "/practice", label: "PRACTICE", sub: "Training drills", bg: "bg-gradient-to-br from-emerald-600 to-teal-600" },
        ].map((a) => (
          <Link key={a.href} href={a.href}>
            <div className={`action-card ${a.bg} p-5 text-white cursor-pointer hover:scale-[1.01] transition-transform`}>
              <div className="relative z-10">
                <p className="font-bold text-lg tracking-tight">{a.label}</p>
                <p className="text-white/60 text-xs mt-0.5">{a.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* ─── Navigation Grid ─── */}
      <section className="space-y-8">
        {[
          {
            title: "PLAY",
            items: [
              { href: "/rooms/create", label: "Create Room", desc: "Start a match" },
              { href: "/rooms", label: "Join Room", desc: "Browse open games" },
              { href: "/ranked", label: "Ranked", desc: "ELO matchmaking" },
              { href: "/offline", label: "Offline", desc: "Play vs AI" },
              { href: "/practice", label: "Practice", desc: "Training drills" },
            ],
          },
          {
            title: "COMPETE",
            items: [
              { href: "/tournaments", label: "Tournaments", desc: "Bracket & round-robin" },
              { href: "/seasons", label: "Seasons", desc: "Weekly leaderboards" },
              { href: "/stats", label: "Leaderboard", desc: "Player rankings" },
              { href: "/achievements", label: "Achievements", desc: "Unlock badges" },
            ],
          },
          {
            title: "SOCIAL",
            items: [
              { href: "/friends", label: "Friends", desc: "Online & invite" },
              { href: "/clips", label: "Clips", desc: "Highlights" },
              { href: "/replays", label: "Replays", desc: "Watch matches" },
              { href: "/matches", label: "History", desc: "Past games" },
            ],
          },
          {
            title: "TOOLS",
            items: [
              { href: "/strategy", label: "Strategy Board", desc: "Draw plays" },
              { href: "/settings", label: "Settings", desc: "Preferences" },
            ],
          },
        ].map((section) => (
          <div key={section.title}>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">
              {section.title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {section.items.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="border border-border/60 rounded-lg p-3 card-lift cursor-pointer group bg-card hover:border-primary/30">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/50 pt-6 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Basket Random — real-time multiplayer basketball
        </p>
      </footer>
    </div>
  )
}
