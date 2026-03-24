import { NextResponse } from "next/server";

// Import activePages count from headless route
// Since we can't directly import module-level state from API routes,
// expose it via a global
declare global {
  var __gameHealth: { activePages: number; maxPages: number; lobbies: number } | undefined;
}

export async function GET() {
  const health = globalThis.__gameHealth || { activePages: 0, maxPages: 10, lobbies: 0 };

  return NextResponse.json({
    status: 'ok',
    timestamp: Date.now(),
    games: {
      activePages: health.activePages,
      maxPages: health.maxPages,
      lobbies: health.lobbies,
    },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  });
}
