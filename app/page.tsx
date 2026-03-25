"use client"

import Link from "next/link"

const QUICK_ACTIONS = [
  { href: "/rooms/create", label: "Play", sub: "Create a room", gradient: "from-orange-500 to-amber-500" },
  { href: "/ranked", label: "Ranked", sub: "ELO matchmaking", gradient: "from-violet-500 to-purple-500" },
  { href: "/rooms", label: "Browse", sub: "Join a game", gradient: "from-cyan-500 to-blue-500" },
]

const SECTIONS = [
  {
    title: "Play",
    items: [
      { href: "/rooms/create", label: "Create Room", icon: "➕" },
      { href: "/rooms", label: "Join Room", icon: "🚪" },
      { href: "/ranked", label: "Ranked", icon: "⚔️" },
      { href: "/offline", label: "Offline", icon: "🎮" },
      { href: "/practice", label: "Practice", icon: "🏋️" },
    ],
  },
  {
    title: "Compete",
    items: [
      { href: "/tournaments", label: "Tournaments", icon: "🏆" },
      { href: "/seasons", label: "Seasons", icon: "📅" },
      { href: "/stats", label: "Leaderboard", icon: "📊" },
      { href: "/achievements", label: "Achievements", icon: "🎖️" },
    ],
  },
  {
    title: "Social",
    items: [
      { href: "/friends", label: "Friends", icon: "👥" },
      { href: "/clips", label: "Clips", icon: "🎬" },
      { href: "/replays", label: "Replays", icon: "⏪" },
      { href: "/matches", label: "History", icon: "📋" },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/strategy", label: "Strategy", icon: "✏️" },
      { href: "/settings", label: "Settings", icon: "⚙️" },
    ],
  },
]

export default function Home() {
  return (
    <div className="container max-w-4xl mx-auto py-16 px-4 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-block">
          <div className="basketball-texture w-16 h-16 flex items-center justify-center mx-auto mb-4 glow-primary">
            <span className="text-2xl">🏀</span>
          </div>
        </div>
        <h1 className="text-5xl font-bold tracking-tight">
          Basket <span className="text-primary">Random</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Real-time multiplayer basketball
        </p>
      </div>

      {/* Quick actions — large glass cards with gradients */}
      <div className="grid grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <div className={`relative overflow-hidden rounded-xl p-6 text-white bg-gradient-to-br ${action.gradient} hover:scale-[1.02] transition-all duration-200 cursor-pointer shadow-lg`}>
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
              <div className="relative">
                <p className="font-bold text-xl">{action.label}</p>
                <p className="text-white/70 text-sm mt-1">{action.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Sections — glass cards */}
      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {section.title}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {section.items.map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="glass-card rounded-xl px-4 py-3.5 transition-glass cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <span className="text-lg opacity-70 group-hover:opacity-100 transition-opacity">
                      {item.icon}
                    </span>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
