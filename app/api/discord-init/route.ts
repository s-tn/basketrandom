import { initDiscord } from "@/lib/discord";

// Initialize Discord bot on first import
let initialized = false;
if (!initialized) {
  initDiscord();
  initialized = true;
}

export function GET() {
  return new Response("ok");
}
