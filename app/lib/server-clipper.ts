import { Readable } from 'stream';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prisma from './prisma';

const CLIPS_DIR = process.env.CLIPS_DIR || join(process.cwd(), 'data', 'clips');

export function createServerClipper(stream: Readable, roomId: string, durationSeconds = 10) {
  const chunks: Buffer[] = [];
  const chunkTimestamps: number[] = [];
  let destroyed = false;

  stream.on('data', (chunk: Buffer) => {
    if (destroyed) return;
    chunks.push(chunk);
    chunkTimestamps.push(Date.now());
    const cutoff = Date.now() - durationSeconds * 1000;
    while (chunkTimestamps.length > 0 && chunkTimestamps[0] < cutoff) {
      chunkTimestamps.shift();
      chunks.shift();
    }
  });

  async function trigger(playerName?: string): Promise<string | null> {
    if (chunks.length === 0) return null;
    await mkdir(CLIPS_DIR, { recursive: true });
    const filename = `${roomId}-${Date.now()}.webm`;
    const buffer = Buffer.concat([...chunks]);
    await writeFile(join(CLIPS_DIR, filename), buffer);
    const clip = await prisma.clip.create({
      data: { roomId, player: playerName || null, filename, duration: durationSeconds, auto: true, shared: true },
    });
    return clip.id;
  }

  function destroy() {
    destroyed = true;
    chunks.length = 0;
    chunkTimestamps.length = 0;
  }

  return { trigger, destroy };
}
