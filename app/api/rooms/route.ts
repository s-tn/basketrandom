import prisma from "@/lib/prisma"

export async function GET() {
    return new Response(JSON.stringify(await prisma.room.findMany()), {
        headers: { "Content-Type": "application/json" },
    })
}


export async function POST(request: Request) {
    // Parse the incoming request body
    const data = await request.json()

    // Simulate processing time
    const { id, createdBy: host, name } = data;

    const newRoom = await prisma.room.create({
        data: {
            // Use the provided data to create a new room
            id, // Ensure this is unique or let the database generate it
            name,
            host, // The user creating the room
            createdAt: new Date(),
        },
    });

    const socket = await prisma.socket.create({
        data: {
            roomId: newRoom.id,
            type: 'lobby'
        }
    });

    // Log the newly created room for debugging
    console.log('New room created:', newRoom)

    // Respond with a success message
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

    const { id, createdBy: host, name, players } = data;

    await prisma.room.update({
        where: { id }, // Specify the room to update by ID
        data: {
            name, // Update the name of the room
            host, // Update the host if necessary
            oppponent: players && players.length > 1 ? players[1] : null, // Update the opponent if provided
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