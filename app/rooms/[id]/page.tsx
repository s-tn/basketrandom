import { RoomDetail } from "@/components/room-detail"
import { notFound } from "next/navigation"
import { getRoomById } from "@/lib/rooms"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    return (
      <div className="p-4">
        <p className="text-red-500">Room ID is required.</p>
        <Link href="/"><Button>Back to Rooms</Button></Link>
      </div>
    )
  }
  try {
    const room = await getRoomById(id)

    if (!room) {
      return (
        <div className="p-4">
          <p className="text-red-500">Room not found. It may have been deleted.</p>
          <Link href="/"><Button>Back to Rooms</Button></Link>
        </div>
      )
    }

    return (
      <div className="container py-8">
        <RoomDetail roomId={id} initialRoom={room} />
      </div>
    )
  } catch (error) {
    console.error("Error fetching room:", error)
    notFound()
  }
}

