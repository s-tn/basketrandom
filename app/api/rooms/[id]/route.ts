import prisma from "@/lib/prisma"

export async function DELETE(request: Request) {
    const id = request.url.match(/\/api\/rooms\/(.*)/)?.[1]

    if (!id) {
        return new Response("Room ID not provided", { status: 400 })
    }

    // Check if the room exists
    const room = await prisma.room.findUnique({
        where: { id },
    })
    if (!room) {
        return new Response("Room not found", { status: 404 })
    }

    // Delete the room
    await prisma.room.delete({
        where: { id },
    })
    console.log(`Room with ID ${id} deleted`)
    await prisma.socket.deleteMany({
        where: { roomId: id },
    })
    return new Response(
        JSON.stringify({ success: true }),
        {
            headers: { "Content-Type": "application/json" },
            status: 200,
        }
    )
}

export async function PUT(request: Request) {
    console.log('put')
    // Parse the incoming request body
    const data = await request.json()

    const { id, createdBy: host, name, players, started } = data;

    await prisma.room.update({
        where: { id }, // Specify the room to update by ID
        data: {
            name, // Update the name of the room
            host, // Update the host if necessary
            oppponent: players && players.length > 1 ? players[1] : null, // Update the opponent if provided
            started, // Reset the started status
        },
    })

    // Respond with a success message indicating update
    return new Response(
        JSON.stringify({ success: true }),
        {
            headers: { "Content-Type": "application/json" },
            status: 200,
        }
    )
}