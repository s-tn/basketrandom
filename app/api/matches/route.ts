import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const player = url.searchParams.get('player');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const where: any = { winner: { not: null } };
  if (player) {
    where.OR = [{ host: player }, { opponent: player }];
  }

  const matches = await prisma.room.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true, name: true, host: true, opponent: true,
      winner: true, score0: true, score1: true,
      wins0: true, wins1: true, rounds: true,
      mode: true, gravity: true, timeLimit: true,
      scoreMax: true, roundGoal: true, createdAt: true,
    },
  });

  return NextResponse.json(matches);
}
