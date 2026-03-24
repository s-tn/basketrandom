import { NextResponse } from "next/server";
import { getPlayerAchievements, ACHIEVEMENTS } from "@/lib/achievements";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playerName = url.searchParams.get('player');

  if (!playerName) {
    return NextResponse.json(ACHIEVEMENTS.map(a => ({ ...a, unlocked: false, unlockedAt: null })));
  }

  const achievements = await getPlayerAchievements(playerName);
  return NextResponse.json(achievements);
}
