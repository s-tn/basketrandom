"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { ThemeToggle } from "./theme-toggle"

const NAV_GROUPS = [
  {
    label: "Play",
    items: [
      { href: "/rooms/create", label: "Create Room" },
      { href: "/rooms", label: "Join Room" },
      { href: "/offline", label: "Offline" },
      { href: "/practice", label: "Practice" },
    ],
  },
  {
    label: "Compete",
    items: [
      { href: "/ranked", label: "Ranked" },
      { href: "/tournaments", label: "Tournaments" },
      { href: "/seasons", label: "Seasons" },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/friends", label: "Friends" },
      { href: "/clips", label: "Clips" },
      { href: "/replays", label: "Replays" },
      { href: "/stats", label: "Stats" },
      { href: "/matches", label: "Match History" },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/achievements", label: "Achievements" },
      { href: "/strategy", label: "Strategy" },
      { href: "/settings", label: "Settings" },
    ],
  },
]

export function Navbar() {
  const pathname = usePathname()
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setPlayerName(localStorage.getItem("playerName"))
  }, [])

  // Don't show navbar on game pages (room detail) — it would overlap the game
  if (pathname?.match(/^\/rooms\/[^/]+$/) && !pathname?.includes("/create") && !pathname?.includes("/join")) {
    return null
  }

  return (
    <nav className="sticky top-0 z-40 w-full glass-nav">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">🏀</span>
          <span>Basket <span className="text-primary">Random</span></span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="relative group">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                {group.label}
              </button>
              <div className="absolute top-full left-0 pt-1 hidden group-hover:block z-50">
                <div className="glass-card rounded-lg shadow-lg py-1 min-w-[140px]">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-3 py-1.5 text-sm transition-colors hover:bg-accent ${
                        pathname === item.href ? "text-primary font-medium" : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Player info + mobile menu */}
        <div className="flex items-center gap-3">
          {playerName ? (
            <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {playerName[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium hidden sm:inline">{playerName}</span>
            </Link>
          ) : (
            <Button size="sm" variant="outline" onClick={() => {
              const name = prompt("Enter your player name:")
              if (name) {
                localStorage.setItem("playerName", name)
                setPlayerName(name)
              }
            }}>
              Set Name
            </Button>
          )}

          <Link
            href="/settings"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          <ThemeToggle />

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="space-y-1.5">
              <div className={`w-5 h-0.5 bg-foreground transition-transform ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
              <div className={`w-5 h-0.5 bg-foreground transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
              <div className={`w-5 h-0.5 bg-foreground transition-transform ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 glass pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="px-4 pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block py-1.5 text-sm ${pathname === item.href ? "text-primary font-medium" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </nav>
  )
}
