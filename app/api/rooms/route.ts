import prisma from "@/lib/prisma"
const notify = (event: string, data: Record<string, any>) => import("@/lib/discord").then(m => m.notify(event, data)).catch(() => {})

export async function GET() {
    return new Response(JSON.stringify(await prisma.room.findMany({ where: { private: false } })), {
        headers: { "Content-Type": "application/json" },
    })
}


export async function POST(request: Request) {
    // Parse the incoming request body
    const data = await request.json()

    // Simulate processing time
    const { id, host, name, scoreMax, roundGoal, tournament, tPassword } = data;

    if (tournament && tPassword !== 'packets') {
        return new Response(
            JSON.stringify({ error: 'Invalid tournament password' }),
            { headers: { "Content-Type": "application/json" }, status: 400 }
        );
    }

    const newRoom = await prisma.room.create({
        data: {
            id,
            name,
            host,
            createdAt: new Date(),
            roundGoal: roundGoal || 3,
            tournament: tournament || false,
            scoreMax: scoreMax || 10,
        },
    });

    notify('room_created', { host, name });

    return new Response(
        JSON.stringify(newRoom),
        { headers: { "Content-Type": "application/json" }, status: 201 }
    )
}

export async function PUT(request: Request) {
    // Parse the incoming request body
    const data = await request.json()

    const { id, host, name, players } = data;

    await prisma.room.update({
        where: { id }, // Specify the room to update by ID
        data: {
            name, // Update the name of the room
            host, // Update the host if necessary
            opponent: players && players.length > 1 ? players[1] : null, // Update the opponent if provided
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