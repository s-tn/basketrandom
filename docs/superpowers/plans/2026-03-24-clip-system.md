# Clip System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add highlight clip recording — auto on goals + manual trigger, local download + optional upload/share, server-side clips for tournaments.

**Architecture:** Client-side MediaRecorder rolling buffer for casual games, server-side stream buffer for tournaments. Clips stored as .webm files on disk, metadata in SQLite via Prisma.

**Tech Stack:** MediaRecorder API, Puppeteer stream, Next.js API routes, Prisma, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-24-clip-system-design.md`

---

## Task 1: Add Clip Prisma Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Clip model and Room relation**

Append to schema:
```prisma
model Clip {
  id        String   @id @default(cuid())
  roomId    String
  player    String?
  filename  String
  duration  Int      @default(10)
  shared    Boolean  @default(false)
  auto      Boolean  @default(true)
  createdAt DateTime @default(now())

  room      Room     @relation(fields: [roomId], references: [id])
}
```

Add to Room model:
```prisma
  clips     Clip[]
```

- [ ] **Step 2: Push schema and generate**

```bash
npx prisma db push --force-reset
npx prisma generate
```

- [ ] **Step 3: Create clips directory**

```bash
mkdir -p data/clips
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Clip model to schema"
```

---

## Task 2: Create Client-Side Clipper

**Files:**
- Create: `public/client/clipper.js`

- [ ] **Step 1: Implement rolling buffer clipper**

```javascript
export function createClipper(canvas, durationSeconds = 10) {
  let chunks = [];
  let recorder = null;
  let chunkTimestamps = [];

  try {
    const stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2_000_000,
    });
  } catch (e) {
    // Fallback if vp9 not supported
    try {
      const stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch {
      return { trigger: () => null, setDuration: () => {}, destroy: () => {} };
    }
  }

  let duration = durationSeconds;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
      chunkTimestamps.push(Date.now());

      // Trim to rolling window
      const cutoff = Date.now() - duration * 1000;
      while (chunkTimestamps.length > 0 && chunkTimestamps[0] < cutoff) {
        chunkTimestamps.shift();
        chunks.shift();
      }
    }
  };

  recorder.start(1000); // 1-second chunks

  function trigger() {
    if (chunks.length === 0) return null;
    const blob = new Blob([...chunks], { type: 'video/webm' });
    return blob;
  }

  function setDuration(seconds) {
    duration = seconds;
  }

  function destroy() {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    chunks = [];
    chunkTimestamps = [];
  }

  return { trigger, setDuration, destroy };
}
```

- [ ] **Step 2: Commit**

```bash
git add public/client/clipper.js
git commit -m "feat: client-side MediaRecorder rolling buffer clipper"
```

---

## Task 3: Integrate Clipper into Game Client

**Files:**
- Modify: `public/client/main.js`

- [ ] **Step 1: Import and initialize clipper**

Add import:
```javascript
import { createClipper } from './clipper';
```

After `await setup(cw)` and before the comms setup, initialize the clipper:
```javascript
let clipper = null;
try {
  const gameCanvas = cw.document.querySelector('canvas');
  if (gameCanvas) {
    const clipDuration = parseInt(localStorage.getItem('clipDuration') || '10', 10);
    clipper = createClipper(gameCanvas, clipDuration);
  }
} catch {}
```

- [ ] **Step 2: Add auto-trigger on goal**

In the existing `c3:sound` listener (the one checking for `sound === "file"`), add after the score reset:
```javascript
if (clipper) {
    const blob = clipper.trigger();
    if (blob) {
        window.postMessage({ type: 'clip', blob, auto: true }, '*');
    }
}
```

- [ ] **Step 3: Add manual trigger listener**

Add keyboard listener for 'c' key:
```javascript
cw.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
        if (clipper) {
            const blob = clipper.trigger();
            if (blob) {
                window.postMessage({ type: 'clip', blob, auto: false }, '*');
            }
        }
    }
});
```

- [ ] **Step 4: Listen for duration change from parent**

```javascript
window.addEventListener('message', (e) => {
    if (e.data?.type === 'clipDuration' && clipper) {
        clipper.setDuration(e.data.duration);
        localStorage.setItem('clipDuration', String(e.data.duration));
    }
});
```

- [ ] **Step 5: Commit**

```bash
git add public/client/main.js
git commit -m "feat: integrate clipper into game client with auto and manual triggers"
```

---

## Task 4: Create Clip Toast Component

**Files:**
- Create: `app/components/clip-toast.tsx`

- [ ] **Step 1: Implement toast notification**

"use client" component that:
- Receives props: `blob: Blob | null`, `auto: boolean`, `roomId: string`, `playerName: string`
- Shows when blob is non-null
- Displays "Goal clipped!" (auto) or "Clip saved!" (manual)
- Two buttons:
  - **Download**: Creates object URL, triggers download as `clip-{timestamp}.webm`
  - **Share**: Uploads blob to `POST /api/clips` as FormData, shows returned URL with copy button
- Auto-dismisses after 8 seconds
- Slide-in animation from bottom-right

Use existing Card component + TailwindCSS for styling.

- [ ] **Step 2: Commit**

```bash
git add app/components/clip-toast.tsx
git commit -m "feat: clip notification toast with download and share"
```

---

## Task 5: Add Clip Controls to Game Container

**Files:**
- Modify: `app/components/game-container.tsx`

- [ ] **Step 1: Add clip state and toast**

Add state:
```typescript
const [clipBlob, setClipBlob] = useState<Blob | null>(null);
const [clipAuto, setClipAuto] = useState(false);
const [clipDuration, setClipDuration] = useState(10);
```

Import ClipToast and add it to the JSX.

- [ ] **Step 2: Listen for clip messages from iframe**

In the existing `cw.addEventListener("message", ...)` handler, add:
```typescript
if (event.data.type === 'clip') {
    setClipBlob(event.data.blob);
    setClipAuto(event.data.auto);
    // Auto-dismiss after 8 seconds
    setTimeout(() => setClipBlob(null), 8000);
}
```

- [ ] **Step 3: Add clip button and duration selector to header**

Add next to the fullscreen button:
- Scissors icon button (from Lucide: `Scissors`) — sends manual clip trigger to iframe
- Small select/dropdown for clip duration (5s/10s/15s) — sends duration change to iframe

```typescript
<button onClick={() => {
    const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
    iframe?.contentWindow?.postMessage({ type: 'manualClip' }, '*');
}} className="border border-input cursor-pointer p-2 rounded-sm">
    <Scissors className="w-4 h-4" />
</button>
```

- [ ] **Step 4: Handle duration change**

When user selects a new duration:
```typescript
const iframe = document.getElementById("game-frame") as HTMLIFrameElement;
iframe?.contentWindow?.postMessage({ type: 'clipDuration', duration: newDuration }, '*');
setClipDuration(newDuration);
localStorage.setItem('clipDuration', String(newDuration));
```

- [ ] **Step 5: Commit**

```bash
git add app/components/game-container.tsx
git commit -m "feat: clip button and duration selector in game container"
```

---

## Task 6: Clip API Routes

**Files:**
- Create: `app/api/clips/route.ts`
- Create: `app/api/clips/[id]/route.ts`

- [ ] **Step 1: Create upload + list endpoint**

`app/api/clips/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const CLIPS_DIR = join(process.cwd(), 'data', 'clips');

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const player = url.searchParams.get('player');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const where: any = { shared: true };
  if (roomId) where.roomId = roomId;
  if (player) where.player = player;

  const clips = await prisma.clip.findMany({
    where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
  });

  return NextResponse.json(clips.map(c => ({
    ...c, url: `/api/clips/${c.id}`,
  })));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const roomId = formData.get('roomId') as string;
  const player = formData.get('player') as string;
  const duration = parseInt(formData.get('duration') as string || '10');
  const auto = formData.get('auto') === 'true';

  if (!file || !roomId) {
    return NextResponse.json({ error: 'Missing file or roomId' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  await mkdir(CLIPS_DIR, { recursive: true });

  const filename = `${roomId}-${Date.now()}.webm`;
  const filepath = join(CLIPS_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const clip = await prisma.clip.create({
    data: { roomId, player, filename, duration, auto, shared: true },
  });

  return NextResponse.json({ id: clip.id, url: `/api/clips/${clip.id}` }, { status: 201 });
}
```

- [ ] **Step 2: Create serve + delete endpoint**

`app/api/clips/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readFile, unlink } from "fs/promises";
import { join } from "path";

const CLIPS_DIR = join(process.cwd(), 'data', 'clips');

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
  const clip = await prisma.clip.findUnique({ where: { id } });
  if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try { await unlink(join(CLIPS_DIR, clip.filename)); } catch {}
  await prisma.clip.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/clips/
git commit -m "feat: clip upload, list, serve, and delete API routes"
```

---

## Task 7: Server-Side Clipper for Tournaments

**Files:**
- Create: `app/lib/server-clipper.ts`
- Modify: `app/api/headless/[id]/route.ts`

- [ ] **Step 1: Create server clipper module**

```typescript
import { Readable } from 'stream';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import prisma from './prisma';

const CLIPS_DIR = join(process.cwd(), 'data', 'clips');

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
    const filepath = join(CLIPS_DIR, filename);
    const buffer = Buffer.concat([...chunks]);
    await writeFile(filepath, buffer);

    const clip = await prisma.clip.create({
      data: {
        roomId,
        player: playerName || null,
        filename,
        duration: durationSeconds,
        auto: true,
        shared: true,
      },
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
```

- [ ] **Step 2: Wire into headless route**

In `app/api/headless/[id]/route.ts`, after the tournament stream is created:

```typescript
import { createServerClipper } from "@/lib/server-clipper";

// After stream setup for tournaments:
let serverClipper: ReturnType<typeof createServerClipper> | null = null;
if (stream) {
    serverClipper = createServerClipper(stream, id);
}
```

In the `__sendState` callback, where score change is detected, add:
```typescript
if (serverClipper) serverClipper.trigger().catch(() => {});
```

In cleanup (page.close), add:
```typescript
if (serverClipper) serverClipper.destroy();
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/server-clipper.ts "app/api/headless/[id]/route.ts"
git commit -m "feat: server-side clip capture for tournament matches"
```

---

## Task 8: Clips Gallery Page

**Files:**
- Create: `app/clips/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create clips gallery page**

"use client" page that:
- Fetches `GET /api/clips` on mount
- Displays a grid of clip cards
- Each card: video element with poster (first frame), player name, duration badge, timestamp
- Click to play inline
- Copy share link button
- Filter by player name (text input)
- Load more pagination

- [ ] **Step 2: Add navigation link**

In `app/page.tsx`, add a "Clips" button alongside Rooms and Tournaments.

- [ ] **Step 3: Commit**

```bash
git add app/clips/ app/page.tsx
git commit -m "feat: clips gallery page with video playback and sharing"
```

---

## Task 9: Handle Manual Clip Trigger from Parent

**Files:**
- Modify: `public/client/main.js`

- [ ] **Step 1: Listen for manual clip message from parent**

Add to the existing `window.addEventListener('message', ...)` or create one:

```javascript
window.addEventListener('message', (e) => {
    if (e.data?.type === 'manualClip' && clipper) {
        const blob = clipper.trigger();
        if (blob) {
            window.postMessage({ type: 'clip', blob, auto: false }, '*');
        }
    }
});
```

This receives the message from the game-container's clip button click.

- [ ] **Step 2: Commit**

```bash
git add public/client/main.js
git commit -m "feat: handle manual clip trigger from parent window"
```
