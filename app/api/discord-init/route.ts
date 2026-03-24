let initialized = false;

export async function GET() {
  if (!initialized) {
    const { initDiscord } = await import("@/lib/discord");
    initDiscord();
    initialized = true;
  }
  return new Response("ok");
}
