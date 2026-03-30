"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings, Menu, X } from "lucide-react"
import { Button } from "./ui/button"
import { ThemeToggle } from "./theme-toggle"

const NAV_ITEMS = [
  { href: "/rooms", label: "Rooms" },
  { href: "/ranked", label: "Ranked" },
  { href: "/tournaments", label: "Tourneys" },
  { href: "/friends", label: "Friends" },
]

const MORE_ITEMS = [
  { href: "/practice", label: "Practice" },
  { href: "/offline", label: "Offline" },
  { href: "/clips", label: "Clips" },
  { href: "/replays", label: "Replays" },
  { href: "/matches", label: "History" },
  { href: "/stats", label: "Stats" },
  { href: "/seasons", label: "Seasons" },
  { href: "/achievements", label: "Achievements" },
  { href: "/strategy", label: "Strategy" },
]

export function Navbar() {
  const pathname = usePathname()
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setPlayerName(localStorage.getItem("playerName"))
  }, [])

  // Hide on active game pages
  if (pathname?.match(/^\/rooms\/[^/]+$/) && !pathname?.includes("/create") && !pathname?.includes("/join")) {
    return null
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur-md">
      <div className="container flex h-12 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-sm tracking-tight">
          <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold">B</span>
          <span className="hidden sm:inline">BASKET<span className="text-primary">RANDOM</span></span>
        </Link>

        {/* Desktop nav — flat links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                pathname === item.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* More dropdown */}
          <div className="relative group">
            <button className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors">
              More
            </button>
            <div className="absolute top-full right-0 pt-1 hidden group-hover:block z-50">
              <div className="bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[150px]">
                {MORE_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-3 py-1.5 text-xs transition-colors hover:bg-muted ${
                      pathname === item.href ? "text-primary font-medium" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {playerName ? (
            <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition">
              <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary">
                {playerName[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{playerName}</span>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" className="text-xs h-7" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" className="text-xs h-7" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </div>
          )}

          <ThemeToggle />

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background py-3 px-4">
          <div className="grid grid-cols-2 gap-1">
            {[...NAV_ITEMS, ...MORE_ITEMS].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-xs font-medium rounded-md ${
                  pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
