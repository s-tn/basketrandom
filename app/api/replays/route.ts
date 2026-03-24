import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const where: any = {};
  if (roomId) where.roomId = roomId;

  const replays = await prisma.replay.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, roomId: true, duration: true, createdAt: true, room: { select: { name: true, host: true, opponent: true } } },
  });
  return NextResponse.json(replays);
}
