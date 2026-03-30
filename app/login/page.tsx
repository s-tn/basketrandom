"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Login failed")
        setLoading(false)
        return
      }

      localStorage.setItem("playerName", data.name)
      const redirect = new URLSearchParams(window.location.search).get("redirect")
      router.push(redirect || "/")
    } catch {
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-2.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" asChild>
              <a href="/api/auth/discord">Continue with Discord</a>
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          No account?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
