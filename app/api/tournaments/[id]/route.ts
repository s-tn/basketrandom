import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateBracket, generateRoundRobin, createMatchRoom } from "@/lib/tournament";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: true,
      matches: {
        include: { player0: true, player1: true, winner: true, room: true },
        orderBy: [{ round: 'asc' }, { matchIndex: 'asc' }],
      },
    },
  });
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tournament);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  switch (body.action) {
    case 'join': {
      const existing = await prisma.tournamentParticipant.findFirst({
        where: { tournamentId: id, playerName: body.playerName },
      });
      if (existing) return NextResponse.json({ error: 'Already joined' }, { status: 400 });
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: id, playerName: body.playerName },
      });
      return NextResponse.json(participant, { status: 201 });
    }
    case 'leave': {
      await prisma.tournamentParticipant.deleteMany({
        where: { tournamentId: id, playerName: body.playerName },
      });
      return NextResponse.json({ ok: true });
    }
    case 'start': {
      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (!body.playerName || tournament.createdBy !== body.playerName) {
        return NextResponse.json({ error: 'Only the creator can start the tournament' }, { status: 403 });
      }
      const participantCount = await prisma.tournamentParticipant.count({ where: { tournamentId: id } });
      if (participantCount < 2) {
        return NextResponse.json({ error: 'Need at least 2 participants' }, { status: 400 });
      }
      if (tournament.format === 'bracket') {
        await generateBracket(id);
      } else {
        await generateRoundRobin(id);
      }
      return NextResponse.json({ ok: true });
    }
    case 'create-room': {
      const room = await createMatchRoom(body.matchId);
      return NextResponse.json(room);
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
