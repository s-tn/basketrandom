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
        const updateData: any = {};
        if (opponent !== undefined) updateData.opponent = opponent;
        if (player3 !== undefined) updateData.player3 = player3;
        if (player4 !== undefined) updateData.player4 = player4;
        const updated = await prisma.room.update({ where: { id: roomId }, data: updateData });
        return new Response(JSON.stringify(updated), { headers: { "Content-Type": "application/json" }, status: 200 });
    }

    // Handle full update (start game, etc.)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (started !== undefined) updateData.started = started;
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