import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface QueueEntry {
  playerName: string;
  elo: number;
  joinedAt: number;
}

interface MatchedPair {
  p1Name: string;
  p2Name: string;
  roomId: string;
}

const queue: QueueEntry[] = [];
const matches: Map<string, MatchedPair> = new Map(); // playerName -> match info

function tryMatch(): { p1: QueueEntry; p2: QueueEntry } | null {
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const eloDiff = Math.abs(queue[i].elo - queue[j].elo);
      const waitTime = Math.max(Date.now() - queue[i].joinedAt, Date.now() - queue[j].joinedAt);
      const maxDiff = 200 + Math.floor(waitTime / 5000) * 50; // Expand range over time

      if (eloDiff <= maxDiff) {
        const [p1] = queue.splice(i, 1);
        const [p2] = queue.splice(j - 1, 1);
        return { p1, p2 };
      }
    }
  }
  return null;
}

async function createRoomForMatch(p1Name: string, p2Name: string): Promise<string> {
  const roomId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  await prisma.room.create({
    data: {
      id: roomId,
      name: `${p1Name} vs ${p2Name}`,
      host: p1Name,
      opponent: p2Name,
      createdAt: new Date(),
      roundGoal: 3,
      scoreMax: 10,
      gravity: 4,
      timeLimit: 0,
      mode: "1v1",
    },
  });
  return roomId;
}

// POST — Join the matchmaking queue
export async function POST(request: Request) {
  // Remove stale entries older than 5 minutes
  const now = Date.now();
  const cutoff = 5 * 60 * 1000;
  for (let i = queue.length - 1; i >= 0; i--) {
    if (now - queue[i].joinedAt > cutoff) queue.splice(i, 1);
  }

  const { playerName } = await request.json();

  if (!playerName) {
    return NextResponse.json({ error: "playerName is required" }, { status: 400 });
  }

  // Get or create player record
  const player = await prisma.player.upsert({
    where: { name: playerName },
    create: { name: playerName },
    update: {},
  });

  // Remove from queue if already present
  const existingIdx = queue.findIndex((e) => e.playerName === playerName);
  if (existingIdx !== -1) queue.splice(existingIdx, 1);

  // Add to queue
  queue.push({ playerName, elo: player.elo, joinedAt: Date.now() });

  // Try to find a match
  const matched = tryMatch();
  if (matched) {
    const roomId = await createRoomForMatch(matched.p1.playerName, matched.p2.playerName);
    const pair: MatchedPair = { p1Name: matched.p1.playerName, p2Name: matched.p2.playerName, roomId };
    matches.set(matched.p1.playerName, pair);
    matches.set(matched.p2.playerName, pair);
  }

  return NextResponse.json({ queued: true, elo: player.elo });
}

// GET — Check queue status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerName = searchParams.get("playerName");

  if (!playerName) {
    return NextResponse.json({ error: "playerName is required" }, { status: 400 });
  }

  const match = matches.get(playerName);
  if (match) {
    const opponent = match.p1Name === playerName ? match.p2Name : match.p1Name;
    // Clean up match record after it's been retrieved
    matches.delete(playerName);
    return NextResponse.json({ inQueue: false, matched: true, roomId: match.roomId, opponent });
  }

  const inQueue = queue.some((e) => e.playerName === playerName);
  return NextResponse.json({ inQueue, matched: false });
}

// DELETE — Leave queue
export async function DELETE(request: Request) {
  const { playerName } = await request.json();

  if (!playerName) {
    return NextResponse.json({ error: "playerName is required" }, { status: 400 });
  }

  const idx = queue.findIndex((e) => e.playerName === playerName);
  if (idx !== -1) queue.splice(idx, 1);

  return NextResponse.json({ removed: true });
}
