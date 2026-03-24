import { NextResponse } from "next/server";

// In-memory online tracking (heartbeat-based)
const onlinePlayers: Map<string, { lastSeen: number; roomId?: string }> = new Map();

// Cleanup stale entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  onlinePlayers.forEach((data, name) => {
    if (now - data.lastSeen > 30000) onlinePlayers.delete(name);
  });
}, 30000);

// POST — heartbeat (player is online)
export async function POST(request: Request) {
  const { playerName, roomId } = await request.json();
  if (!playerName) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  onlinePlayers.set(playerName, { lastSeen: Date.now(), roomId });
  return NextResponse.json({ ok: true });
}

// GET — check who's online from a list
export async function GET(request: Request) {
  const url = new URL(request.url);
  const names = url.searchParams.get('names')?.split(',') || [];

  const statuses: Record<string, { online: boolean; roomId?: string }> = {};
  for (const name of names) {
    const data = onlinePlayers.get(name);
    statuses[name] = {
      online: !!data && Date.now() - data.lastSeen < 30000,
      roomId: data?.roomId,
    };
  }
  return NextResponse.json(statuses);
}
