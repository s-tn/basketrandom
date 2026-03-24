import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const rooms = await prisma.room.findMany({
    where: { winner: { not: null } },
    select: { host: true, opponent: true, winner: true, score0: true, score1: true },
  });

  const stats: Record<string, { wins: number; losses: number; goalsFor: number; goalsAgainst: number }> = {};

  for (const room of rooms) {
    if (!room.opponent) continue;

    // Initialize
    for (const name of [room.host, room.opponent]) {
      if (!stats[name]) stats[name] = { wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
    }

    // Host stats
    if (room.winner === 0) {
      stats[room.host].wins++;
      stats[room.opponent].losses++;
    } else {
      stats[room.host].losses++;
      stats[room.opponent].wins++;
    }
    stats[room.host].goalsFor += room.score0;
    stats[room.host].goalsAgainst += room.score1;
    stats[room.opponent].goalsFor += room.score1;
    stats[room.opponent].goalsAgainst += room.score0;
  }

  const leaderboard = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      ...s,
      games: s.wins + s.losses,
      winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

  return NextResponse.json(leaderboard);
}
