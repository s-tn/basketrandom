import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  const roomIds = url.searchParams.get('roomIds');
  const where: any = {};
  if (roomId) where.roomId = roomId;
  if (roomIds) {
    where.roomId = { in: roomIds.split(',') };
  }

  const replays = await prisma.replay.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, roomId: true, duration: true, createdAt: true, room: { select: { name: true, host: true, opponent: true } } },
  });
  return NextResponse.json(replays);
}
