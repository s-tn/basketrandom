import { RoomDetail } from "@/components/room-detail"
import { notFound } from "next/navigation"
import { getRoomById } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { OfflineGame } from "@/components/offline-game"

export default async function RoomPage() {
    return (
      <div className="container py-8">
        <OfflineGame />
      </div>
    )
}

