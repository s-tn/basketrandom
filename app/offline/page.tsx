import { RoomDetail } from "@/components/room-detail"
import { notFound } from "next/navigation"
import { getRoomById } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { OfflineGame } from "@/components/offline-game"

export default async function RoomPage() {
    return (
      <div className="min-h-screen">
        <div className="container py-4">
          <nav className="mb-4">
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back Home
            </a>
          </nav>
          <OfflineGame />
        </div>
      </div>
    )
}

