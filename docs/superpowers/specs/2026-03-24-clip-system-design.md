# Clip System — Design Spec

## Overview

Add a highlight clip recording system to Basket Random. Players can capture short video clips of gameplay moments — automatically on goals or manually via hotkey/button. Clips can be downloaded locally or uploaded for shareable links. Tournament/streamed games get server-side clips; casual games use client-side recording.

## Architecture

```
┌──────────────────────────────────┐
│  Client (Browser)                │
│  MediaRecorder rolling buffer    │
│  Auto-trigger on goal sound      │
│  Manual trigger via button/key   │
│  Download .webm / Upload to API  │
└──────────┬───────────────────────┘
           │ POST /api/clips (upload)
┌──────────▼───────────────────────┐
│  Server                          │
│  Clip storage: /data/clips/      │
│  Server clipper (tournaments)    │
│  Clip API (upload/list/serve)    │
└──────────┬───────────────────────┘
           │
┌──────────▼───────────────────────┐
│  SQLite (Prisma)                 │
│  Clip model (metadata)           │
└──────────────────────────────────┘
```

---

## Client-Side Clip Capture (Casual Games)

### Rolling Buffer via MediaRecorder

The client-side clipper uses the browser's `MediaRecorder` API to continuously record the game iframe's canvas into a rolling buffer.

**Implementation (`public/client/clipper.js`):**

1. Capture the game iframe's content using `iframe.contentWindow.document.querySelector('canvas').captureStream(30)` (30 FPS)
2. Create a `MediaRecorder` with `mimeType: 'video/webm;codecs=vp9'`
3. Collect chunks in an array via `ondataavailable` (fire every 1 second)
4. Maintain a rolling window: keep only the last N seconds of chunks (configurable: 5, 10, or 15)
5. When a clip is triggered, combine the buffered chunks into a single Blob

**Exports:**
```javascript
export function createClipper(canvas, durationSeconds = 10)
// Returns: { trigger(), setDuration(seconds), destroy() }
```

- `trigger()` — Finalizes the current buffer into a .webm Blob, returns it. Starts a new buffer.
- `setDuration(seconds)` — Changes the rolling buffer window (5, 10, or 15)
- `destroy()` — Stops recording, cleans up

### Auto-Trigger on Goals

The existing `c3:sound` event listener (in `main.js`) already detects goals when the "file" sound plays. Add a clip trigger there:

```javascript
addEventListener('c3:sound', ({detail: { sound }}) => {
    if (sound === "file") {
        // existing score reset...
        clipper.trigger(); // NEW: auto-capture goal clip
    }
});
```

The triggered clip Blob is sent to the parent window via `postMessage`:
```javascript
window.postMessage({ type: 'clip', blob: clipBlob, auto: true }, '*');
```

### Manual Trigger

Players can manually clip anytime via:
- A "Clip" button in the game-container header bar (next to fullscreen button)
- Keyboard shortcut: `C` key (not used by game — game only uses `W` and `ArrowUp`)

Manual clips also post to parent:
```javascript
window.postMessage({ type: 'clip', blob: clipBlob, auto: false }, '*');
```

### Clip Duration Setting

Stored in `localStorage` as `clipDuration` (default: 10). UI selector in game-container header — small dropdown with 5s/10s/15s options. Passed to `createClipper` on init and updated via `setDuration()`.

---

## Server-Side Clip Capture (Tournament/Streamed Games)

### Rolling Buffer from Puppeteer Stream

For tournament matches where `puppeteer-stream` is active, the server maintains its own rolling buffer.

**Implementation (`app/lib/server-clipper.ts`):**

1. Receive the readable stream from `puppeteer-stream`
2. Pipe through a `PassThrough` transform that collects chunks
3. Keep the last N seconds of chunks (matching the game's configured duration, default 10s)
4. On trigger: combine chunks into a Buffer, write to `/data/clips/{roomId}-{timestamp}.webm`
5. Create a `Clip` record in the database

**Exports:**
```typescript
export function createServerClipper(stream: Readable, roomId: string, durationSeconds?: number)
// Returns: { trigger(playerName?: string): Promise<string>, destroy(): void }
```

- `trigger(playerName?)` — Saves clip to disk, creates DB record, returns clip ID
- `destroy()` — Stops collecting, cleans up

### Auto-Trigger on Score Change

In the headless route's `__sendState` callback, when a score change is detected (already implemented), also trigger the server clipper:

```typescript
if (lastState && (state.score0 !== lastState.score0 || state.score1 !== lastState.score1)) {
    // existing score DB update...
    if (serverClipper) serverClipper.trigger(); // NEW
}
```

---

## Data Model

### Prisma Model

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

Add back-relation to Room:
```prisma
model Room {
  // ...existing fields
  clips     Clip[]
}
```

### File Storage

Clips saved to `/data/clips/` directory (same volume mount as SQLite on Fly.io).

Filename format: `{roomId}-{timestamp}.webm`

Max clip size: ~2-5MB per clip at 30fps VP9 for 15 seconds. Set a reasonable limit.

---

## API

### `POST /api/clips` — Upload a clip

Request: `multipart/form-data` with fields:
- `file` — .webm blob
- `roomId` — string
- `player` — string (from localStorage)
- `duration` — number
- `auto` — boolean

Response: `{ id, url }` where url is `/api/clips/{id}`

Validation:
- Max file size: 10MB
- Must be .webm
- `roomId` must exist

### `GET /api/clips` — List clips

Query params: `?roomId=`, `?player=`, `?limit=`, `?offset=`

Returns: Array of clip metadata (id, roomId, player, duration, auto, createdAt, url)

Only returns clips where `shared: true` (or clips belonging to the requesting player).

### `GET /api/clips/[id]` — Serve clip file

Streams the .webm file from `/data/clips/`. Sets proper content-type and cache headers.

### `DELETE /api/clips/[id]` — Delete a clip

Removes file from disk and DB record.

---

## UI

### Game Container Additions (`app/components/game-container.tsx`)

1. **Clip button** in the header bar (scissors icon from Lucide):
   - Click triggers manual clip
   - Small dropdown for duration setting (5s/10s/15s)

2. **Clip toast notification** — when a clip is captured (auto or manual):
   - Slides in from bottom-right
   - Shows: "Goal clipped!" or "Clip saved!"
   - Two buttons: [Download] [Share]
   - Download: creates a download link for the blob
   - Share: uploads to `/api/clips`, shows the shareable URL
   - Auto-dismisses after 8 seconds

### Clips Gallery Page (`/clips`)

- Grid of clip cards with video thumbnails (poster frame)
- Each card shows: player name, room name, duration badge, timestamp
- Click to play inline (HTML5 video player)
- Share link button (copy to clipboard)
- Filter by: player name, date range
- Pagination

### Navigation

Add "Clips" link to the home page alongside Rooms and Tournaments.

---

## File Map

### New Files
```
public/client/clipper.js           — Client-side MediaRecorder rolling buffer
app/lib/server-clipper.ts          — Server-side clip capture from Puppeteer stream
app/api/clips/route.ts             — Clip upload + list API
app/api/clips/[id]/route.ts        — Serve + delete clip file
app/clips/page.tsx                 — Clips gallery page
app/components/clip-toast.tsx      — Clip notification toast
```

### Modified Files
```
prisma/schema.prisma               — Add Clip model + Room relation
public/client/main.js              — Initialize clipper, auto-trigger on goals
app/components/game-container.tsx   — Clip button, duration selector, toast handler
app/api/headless/[id]/route.ts     — Initialize server clipper for tournaments
app/page.tsx                       — Add Clips navigation link
```

---

## Key Decisions

1. **WebM/VP9** — Universal browser support for MediaRecorder. No transcoding needed.
2. **Rolling buffer, not continuous recording** — Only keeps last N seconds in memory. No disk I/O until clip is triggered.
3. **Client clips are local-first** — Download immediately, upload only on explicit "Share". Reduces server load.
4. **Server clips for tournaments only** — Puppeteer stream is only active for tournament matches. No extra resource cost.
5. **No clip editing** — Out of scope. Players get raw clips. Can trim externally.
6. **10MB max upload** — 15s at 30fps VP9 is ~3-5MB. 10MB cap is generous with headroom.
