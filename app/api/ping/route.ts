import { NextResponse } from "next/server"

export async function GET() {
  // Simulate a small random delay (10-50ms)
  await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 40) + 10))

  return NextResponse.json({ success: true, timestamp: Date.now() })
}

