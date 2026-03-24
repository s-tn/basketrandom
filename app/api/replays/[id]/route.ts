import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const replay = await prisma.replay.findUnique({
    where: { id },
    include: { room: { select: { name: true, host: true, opponent: true } } },
  });
  if (!replay) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(replay);
}
