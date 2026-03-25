import prisma from "@/lib/prisma"
const notify = (event: string, data: Record<string, any>) => import("@/lib/discord").then(m => m.notify(event, data)).catch(() => {})

export async function GET(request: Request) {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode');
    const status = url.searchParams.get('status'); // 'waiting' | 'playing' | 'all'
    const sort = url.searchParams.get('sort') || 'newest';

    const where: any = { private: false };
    if (mode && mode !== 'all') where.mode = mode;
    if (status === 'waiting') { where.started = false; where.winner = null; }
    if (status === 'playing') { where.started = true; where.winner = null; }

    const orderBy: any = sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' };

    return new Response(JSON.stringify(await prisma.room.findMany({ where, orderBy })), {
        headers: { "Content-Type": "application/json" },
    });
}


export async function POST(request: Request) {
    // Parse the incoming request body
    const data = await request.json()

    // Simulate processing time
    const { id, host, name, scoreMax, roundGoal, gravity, timeLimit, tournament, tPassword, mode } = data;

    if (!name || typeof name !== 'string' || name.length > 50) {
        return new Response(JSON.stringify({ error: 'Invalid room name' }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (!host || typeof host !== 'string' || host.length > 30) {
        return new Response(JSON.stringify({ error: 'Invalid host name' }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (!id || typeof id !== 'string' || id.length > 20) {
        return new Response(JSON.stringify({ error: 'Invalid room ID' }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (tournament && tPassword !== (process.env.TOURNAMENT_PASSWORD || 'packets')) {
        return new Response(
            JSON.stringify({ error: 'Invalid tournament password' }),
            { headers: { "Content-Type": "application/json" }, status: 400 }
        );
    }

    try {
        const newRoom = await prisma.room.create({
            data: {
                id,
                name,
                host,
                createdAt: new Date(),
                roundGoal: roundGoal || 3,
                tournament: tournament || false,
                scoreMax: scoreMax || 10,
                gravity: gravity ?? 4,
                timeLimit: timeLimit ?? 0,
                mode: mode || '1v1',
            },
        });

        notify('room_created', { host, name });

        return new Response(
            JSON.stringify(newRoom),
            { headers: { "Content-Type": "application/json" }, status: 201 }
        )
    } catch (e: any) {
        if (e?.code === 'P2002') {
            return new Response(JSON.stringify({ error: 'Room ID already exists' }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: 'Failed to create room' }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}

export async function PUT(request: Request) {
    // Parse the incoming request body
    const data = await request.json()

    const { id, host, name, players } = data;

    if (data.name && (typeof data.name !== 'string' || data.name.length > 50)) {
        return new Response(JSON.stringify({ error: 'Invalid name' }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (data.host && (typeof data.host !== 'string' || data.host.length > 30)) {
        return new Response(JSON.stringify({ error: 'Invalid host' }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

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