"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"

interface ClipToastProps {
  blob: Blob | null
  auto: boolean
  roomId: string
  playerName: string
  onDismiss: () => void
}

export function ClipToast({
  blob,
  auto,
  roomId,
  playerName,
  onDismiss,
}: ClipToastProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!blob) return null

  function handleDownload() {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `clip-${Date.now()}.webm`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleShare() {
    if (!blob) return
    setSharing(true)
    try {
      const form = new FormData()
      form.append("file", blob, `clip-${Date.now()}.webm`)
      form.append("roomId", roomId)
      form.append("player", playerName)
      form.append("duration", "10")
      form.append("auto", String(auto))

      const res = await fetch("/api/clips", { method: "POST", body: form })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setShareUrl(`${window.location.origin}${data.url}`)
    } catch (err) {
      console.error("Clip share failed:", err)
    } finally {
      setSharing(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <Card className="w-80 shadow-lg">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              {auto ? "Goal clipped!" : "Clip saved!"}
            </CardTitle>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors leading-none"
              aria-label="Dismiss"
            >
              &#x2715;
            </button>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-3">
          {!shareUrl ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleDownload}>
                Download
              </Button>
              <Button
                size="sm"
                onClick={handleShare}
                disabled={sharing}
              >
                {sharing ? "Uploading…" : "Share"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground break-all">{shareUrl}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  Download
                </Button>
                <Button size="sm" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
