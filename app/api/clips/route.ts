import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const CLIPS_DIR = process.env.CLIPS_DIR || join(process.cwd(), 'data', 'clips');

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const player = url.searchParams.get('player');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const where: any = { shared: true };
  if (roomId) where.roomId = roomId;
  if (player) where.player = player;

  const clips = await prisma.clip.findMany({
    where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
  });

  return NextResponse.json(clips.map(c => ({ ...c, url: `/api/clips/${c.id}` })));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const roomId = formData.get('roomId') as string;
  const player = formData.get('player') as string;
  const duration = parseInt(formData.get('duration') as string || '10', 10);
  const auto = formData.get('auto') === 'true';

  if (!file || !roomId) {
    return NextResponse.json({ error: 'Missing file or roomId' }, { status: 400 });
  }
  if (roomId.includes('/') || roomId.includes('\\') || roomId.includes('..')) {
    return NextResponse.json({ error: 'Invalid roomId' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  await mkdir(CLIPS_DIR, { recursive: true });
  const filename = `${roomId}-${Date.now()}.webm`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(CLIPS_DIR, filename), buffer);

  const clip = await prisma.clip.create({
    data: { roomId, player, filename, duration, auto, shared: true },
  });

  return NextResponse.json({ id: clip.id, url: `/api/clips/${clip.id}` }, { status: 201 });
}
