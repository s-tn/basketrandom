import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/seasons";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type === "current") {
    const season = await getCurrentSeason();
    const standings = await prisma.seasonStanding.findMany({
      where: { seasonId: season.id },
      orderBy: { wins: "desc" },
      take: 50,
    });
    return NextResponse.json({ season, standings });
  }

  if (type === "rewards") {
    const player = url.searchParams.get("player");
    const rewards = player
      ? await prisma.seasonReward.findMany({
          where: { playerName: player },
          orderBy: { awardedAt: "desc" },
        })
      : await prisma.seasonReward.findMany({
          orderBy: { awardedAt: "desc" },
          take: 50,
        });
    return NextResponse.json(rewards);
  }

  // All seasons
  const seasons = await prisma.season.findMany({ orderBy: { number: "desc" }, take: 10 });
  return NextResponse.json(seasons);
}
