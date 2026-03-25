import prisma from "@/lib/prisma"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const room = await prisma.room.findUnique({ where: { id } })
    if (!room) {
        return new Response(JSON.stringify({ error: "Room not found" }), {
            headers: { "Content-Type": "application/json" },
            status: 404,
        })
    }

    return new Response(JSON.stringify(room), {
        headers: { "Content-Type": "application/json" },
        status: 200,
    })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const url = new URL(request.url);
    const caller = url.searchParams.get('host');

    // Check if the room exists
    const room = await prisma.room.findUnique({
        where: { id },
    })
    if (!room) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (caller && room.host !== caller) {
        return new Response(JSON.stringify({ error: 'Only the host can delete' }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    // Delete the room
    await prisma.room.delete({
        where: { id },
    })
    return new Response(
        JSON.stringify({ success: true }),
        {
            headers: { "Content-Type": "application/json" },
            status: 200,
        }
    )
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: routeId } = await params;
    // Parse the incoming request body
    const data = await request.json()

    const { id: bodyId, createdBy: host, name, players, started, opponent, player3, player4, leave } = data;
    const roomId = routeId || bodyId;

    // Handle leave
    if (leave) {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404 });
        const updateData: any = {};
        if (room.player4 === leave) updateData.player4 = null;
        else if (room.player3 === leave) updateData.player3 = null;
        else if (room.opponent === leave) updateData.opponent = null;
        const updated = await prisma.room.update({ where: { id: roomId }, data: updateData });
        return new Response(JSON.stringify(updated), { headers: { "Content-Type": "application/json" }, status: 200 });
    }

    // Handle join (opponent, player3, player4)
    if (opponent !== undefined || player3 !== undefined || player4 !== undefined) {
        const currentRoom = await prisma.room.findUnique({ where: { id: roomId } });
        if (!currentRoom) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        const updateData: any = {};
        // opponent can only be set if currently null
        if (opponent !== undefined) {
            if (currentRoom.opponent !== null) {
                return new Response(JSON.stringify({ error: 'Opponent slot already taken' }), { status: 409, headers: { "Content-Type": "application/json" } });
            }
            updateData.opponent = opponent;
        }
        if (player3 !== undefined) updateData.player3 = player3;
        if (player4 !== undefined) updateData.player4 = player4;
        const updated = await prisma.room.update({ where: { id: roomId }, data: updateData });
        return new Response(JSON.stringify(updated), { headers: { "Content-Type": "application/json" }, status: 200 });
    }

    // Handle full update (start game, etc.)
    const currentRoom = await prisma.room.findUnique({ where: { id: roomId } });
    if (!currentRoom) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    // started can only be set by the host
    if (started !== undefined) {
        if (host && currentRoom.host !== host) {
            return new Response(JSON.stringify({ error: 'Only the host can start the game' }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
        updateData.started = started;
    }
    if (players && players.length > 1) updateData.opponent = players[1];
    if (players && players.length > 2) updateData.player3 = players[2];
    if (players && players.length > 3) updateData.player4 = players[3];

    const updated = await prisma.room.update({
        where: { id: roomId },
        data: updateData,
    })

    return new Response(
        JSON.stringify(updated),
        {
            headers: { "Content-Type": "application/json" },
            status: 200,
        }
    )
}