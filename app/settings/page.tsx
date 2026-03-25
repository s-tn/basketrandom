"use client"

import { useState, useEffect, useCallback } from "react"
import { useTheme } from "next-themes"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { SKINS } from "@/components/skin-picker"

interface AuthUser {
  guest: boolean
  id?: string
  name?: string
  discordAvatar?: string | null
}

const CLIP_DURATIONS = [5, 10, 15] as const
type ClipDuration = (typeof CLIP_DURATIONS)[number]

function SavedIndicator({ show }: { show: boolean }) {
  return (
    <span
      className={`text-xs text-green-600 dark:text-green-400 transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      Saved!
    </span>
  )
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

  // Auth state
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Profile
  const [playerName, setPlayerName] = useState("")
  const [nameSaved, setNameSaved] = useState(false)

  // Game
  const [playerSkin, setPlayerSkin] = useState("default")
  const [skinSaved, setSkinSaved] = useState(false)
  const [clipDuration, setClipDuration] = useState<ClipDuration>(10)
  const [clipSaved, setClipSaved] = useState(false)

  // Data
  const [resetConfirm, setResetConfirm] = useState(false)

  // Load initial values from localStorage + fetch auth
  useEffect(() => {
    setPlayerName(localStorage.getItem("playerName") ?? "")
    setPlayerSkin(localStorage.getItem("playerSkin") ?? "default")
    const stored = localStorage.getItem("clipDuration")
    if (stored && CLIP_DURATIONS.includes(Number(stored) as ClipDuration)) {
      setClipDuration(Number(stored) as ClipDuration)
    }

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: AuthUser) => setUser(data))
      .catch(() => setUser({ guest: true }))
      .finally(() => setAuthLoading(false))
  }, [])

  // Flash a "Saved!" indicator for 1.5 s
  function flashSaved(setter: (v: boolean) => void) {
    setter(true)
    setTimeout(() => setter(false), 1500)
  }

  const handleNameChange = useCallback(
    (value: string) => {
      setPlayerName(value)
      localStorage.setItem("playerName", value)
      flashSaved(setNameSaved)
    },
    []
  )

  const handleSkinSelect = useCallback((skinId: string) => {
    setPlayerSkin(skinId)
    localStorage.setItem("playerSkin", skinId)
    flashSaved(setSkinSaved)
  }, [])

  const handleClipDuration = useCallback((dur: ClipDuration) => {
    setClipDuration(dur)
    localStorage.setItem("clipDuration", String(dur))
    flashSaved(setClipSaved)
  }, [])

  function handleResetSettings() {
    if (!resetConfirm) {
      setResetConfirm(true)
      setTimeout(() => setResetConfirm(false), 3000)
      return
    }
    localStorage.removeItem("playerName")
    localStorage.removeItem("playerSkin")
    localStorage.removeItem("clipDuration")
    window.location.reload()
  }

  const isDiscordLinked = !authLoading && user && !user.guest

  return (
    <div className="container max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your profile, gameplay, and display preferences.
        </p>
      </div>

      {/* ── Profile ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your identity in Basket Random.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Player name */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="playerName">Player name</Label>
              <SavedIndicator show={nameSaved} />
            </div>
            <p className="text-xs text-muted-foreground">
              Shown in lobbies, chat, and leaderboards. Stored locally.
            </p>
            <Input
              id="playerName"
              value={playerName}
              maxLength={24}
              placeholder="Enter a display name…"
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          {/* Discord link */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Discord account</p>
              <p className="text-xs text-muted-foreground">
                Link Discord to save stats and appear on leaderboards across devices.
              </p>
            </div>
            {authLoading ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : isDiscordLinked ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-medium truncate max-w-[120px]">{user!.name}</span>
                <Badge className="bg-[#5865F2] hover:bg-[#5865F2] text-white border-0 text-xs">
                  Linked
                </Badge>
              </div>
            ) : (
              <a href="/api/auth/discord" className="shrink-0">
                <Button size="sm" className="bg-[#5865F2] hover:bg-[#4752c4] text-white border-0 gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                  Link Discord
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Game ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Game</CardTitle>
          <CardDescription>Character appearance and recording preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Skin picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Character skin</p>
                <p className="text-xs text-muted-foreground">Pick a color for your player.</p>
              </div>
              <SavedIndicator show={skinSaved} />
            </div>
            <div className="flex flex-wrap gap-3">
              {SKINS.map((skin) => {
                const isSelected = playerSkin === skin.id
                return (
                  <button
                    key={skin.id}
                    title={skin.name}
                    onClick={() => handleSkinSelect(skin.id)}
                    className={
                      "w-9 h-9 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                      (isSelected
                        ? "border-foreground ring-2 ring-foreground scale-110"
                        : "border-transparent hover:scale-105 hover:border-muted-foreground")
                    }
                    style={{ backgroundColor: skin.color }}
                    aria-label={skin.name}
                    aria-pressed={isSelected}
                  />
                )
              })}
            </div>
            {/* Active skin label */}
            <p className="text-xs text-muted-foreground">
              Selected:{" "}
              <span className="font-medium text-foreground">
                {SKINS.find((s) => s.id === playerSkin)?.name ?? "Default"}
              </span>
            </p>
          </div>

          {/* Clip duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Clip duration</p>
                <p className="text-xs text-muted-foreground">
                  How many seconds the rolling buffer retains when you save a clip.
                </p>
              </div>
              <SavedIndicator show={clipSaved} />
            </div>
            <div className="flex gap-2">
              {CLIP_DURATIONS.map((dur) => (
                <button
                  key={dur}
                  onClick={() => handleClipDuration(dur)}
                  className={`px-5 py-2 rounded-md text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    clipDuration === dur
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
                  }`}
                  aria-pressed={clipDuration === dur}
                >
                  {dur}s
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Display ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
          <CardDescription>Choose how the app looks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">
              System follows your OS dark/light preference automatically.
            </p>
            <div className="flex gap-2 pt-1">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-4 py-2 rounded-md text-sm font-medium border capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    theme === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
                  }`}
                  aria-pressed={theme === t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Data ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>Manage your local data and preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Clear match history — informational */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Clear match history</p>
              <p className="text-xs text-muted-foreground">
                Match history is stored on the server and cannot be cleared from here.
              </p>
            </div>
            <Button variant="outline" size="sm" disabled className="shrink-0 text-muted-foreground">
              Not available
            </Button>
          </div>

          <div className="border-t" />

          {/* Reset settings */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Reset settings to defaults</p>
              <p className="text-xs text-muted-foreground">
                Clears your saved name, skin, and clip duration from localStorage and reloads.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSettings}
              className={`shrink-0 transition-colors ${
                resetConfirm
                  ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  : ""
              }`}
            >
              {resetConfirm ? "Confirm reset?" : "Reset"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
