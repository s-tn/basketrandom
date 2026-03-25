import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET — get bets for a room or player's wallet
export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const player = url.searchParams.get('player');

  if (player) {
    const wallet = await prisma.wallet.upsert({
      where: { playerName: player },
      create: { playerName: player, balance: 1000 },
      update: {},
    });
    const bets = await prisma.bet.findMany({
      where: { playerName: player },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json({ wallet, bets });
  }

  if (roomId) {
    const bets = await prisma.bet.findMany({ where: { roomId } });
    const totals: Record<number, number> = { 0: 0, 1: 0 };
    for (const bet of bets) totals[bet.predictedWinner as 0 | 1] += bet.amount;
    return NextResponse.json({ bets, totals });
  }

  return NextResponse.json([]);
}

// POST — place a bet
export async function POST(request: Request) {
  const { playerName, roomId, predictedWinner, amount } = await request.json();

  if (!playerName || !roomId || (predictedWinner !== 0 && predictedWinner !== 1) || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid bet' }, { status: 400 });
  }

  // Check wallet
  await prisma.wallet.upsert({
    where: { playerName },
    create: { playerName, balance: 1000 },
    update: {},
  });

  // Check no existing bet on this room
  const existing = await prisma.bet.findFirst({
    where: { roomId, playerName, resolved: false },
  });
  if (existing) {
    return NextResponse.json({ error: 'Already bet on this match' }, { status: 400 });
  }

  let bet;
  try {
    bet = await prisma.$transaction(async (tx) => {
      const result = await tx.wallet.updateMany({
        where: { playerName, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (result.count === 0) throw new Error('Insufficient balance');
      return tx.bet.create({ data: { roomId, playerName, predictedWinner, amount } });
    });
  } catch (err: any) {
    if (err?.message === 'Insufficient balance') {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json(bet, { status: 201 });
}
