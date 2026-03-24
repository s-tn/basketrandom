import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const players = await prisma.player.findMany({
    where: { wins: { gt: 0 } }, // Only show players who've played
    orderBy: { elo: "desc" },
    take: 50,
  });
  return NextResponse.json(players);
}
