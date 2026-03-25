import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const sessionCookie = request.headers.get('cookie')?.split(';').find(c => c.trim().startsWith('session='));
  if (!sessionCookie) {
    return NextResponse.json({ guest: true });
  }

  try {
    const sessionValue = sessionCookie.trim().substring('session='.length);
    const session = JSON.parse(Buffer.from(sessionValue, 'base64').toString());
    const player = await prisma.player.findUnique({ where: { id: session.id } });
    if (!player) return NextResponse.json({ guest: true });

    return NextResponse.json({
      guest: false,
      id: player.id,
      name: player.name,
      discordAvatar: player.discordAvatar,
      elo: player.elo,
      wins: player.wins,
      losses: player.losses,
    });
  } catch {
    return NextResponse.json({ guest: true });
  }
}
