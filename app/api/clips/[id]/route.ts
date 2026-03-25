import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readFile, unlink } from "fs/promises";
import { join } from "path";

const CLIPS_DIR = process.env.CLIPS_DIR || join(process.cwd(), 'data', 'clips');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clip = await prisma.clip.findUnique({ where: { id } });
  if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const file = await readFile(join(CLIPS_DIR, clip.filename));
    return new Response(file, {
      headers: {
        'Content-Type': 'video/webm',
        'Content-Disposition': `inline; filename="${clip.filename}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const player = url.searchParams.get('player');

  const clip = await prisma.clip.findUnique({ where: { id } });
  if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Only the clip owner can delete
  if (player && clip.player && clip.player !== player) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try { await unlink(join(CLIPS_DIR, clip.filename)); } catch {}
  await prisma.clip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
