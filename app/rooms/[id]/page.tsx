import { RoomDetail } from "@/components/room-detail"
import { notFound } from "next/navigation"
import { getRoomById } from "@/lib/rooms"

export default async function RoomPage({ params }: { params: { id: string } }) {
  try {
    const room = await getRoomById(params.id)

    if (!room) {
      notFound()
    }

    return (
      <div className="container py-8">
        <RoomDetail roomId={params.id} initialRoom={room} />
      </div>
    )
  } catch (error) {
    console.error("Error fetching room:", error)
    notFound()
  }
}

