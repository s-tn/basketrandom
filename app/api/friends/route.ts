import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET — list friends for a player
export async function GET(request: Request) {
  const url = new URL(request.url);
  const player = url.searchParams.get('player');
  if (!player) return NextResponse.json([]);

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ player1: player }, { player2: player }] },
  });

  const friends = friendships.map(f => f.player1 === player ? f.player2 : f.player1);
  return NextResponse.json(friends);
}

// POST — add friend
export async function POST(request: Request) {
  const { player, friend } = await request.json();
  if (!player || !friend || player === friend) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  // Sort names to prevent duplicate (A,B) and (B,A)
  const [p1, p2] = [player, friend].sort();
  try {
    await prisma.friendship.create({ data: { player1: p1, player2: p2 } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Already friends' }, { status: 400 });
  }
}

// DELETE — remove friend
export async function DELETE(request: Request) {
  const { player, friend } = await request.json();
  const [p1, p2] = [player, friend].sort();
  await prisma.friendship.deleteMany({ where: { player1: p1, player2: p2 } });
  return NextResponse.json({ ok: true });
}
