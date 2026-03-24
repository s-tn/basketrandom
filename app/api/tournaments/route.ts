import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
const notify = (event: string, data: Record<string, any>) => import("@/lib/discord").then(m => m.notify(event, data)).catch(() => {});

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    include: { participants: true, matches: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(tournaments);
}

export async function POST(request: Request) {
  const body = await request.json();
  const tournament = await prisma.tournament.create({
    data: {
      name: body.name,
      format: body.format,
      maxPlayers: body.maxPlayers || 8,
      streamed: body.streamed || false,
      private: body.private || false,
      createdBy: body.createdBy,
    },
  });
  notify('tournament_created', { name: body.name, format: body.format, maxPlayers: body.maxPlayers || 8 });
  return NextResponse.json(tournament, { status: 201 });
}
