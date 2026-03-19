# Basket Random Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Basket Random as a full-featured real-time multiplayer basketball game with smooth netcode, tournament system, Discord integration, and Twitch streaming.

**Architecture:** Server-authoritative game running Construct 3 in headless Puppeteer. Binary WebSocket protocol with client-side interpolation buffer for smooth rendering. Tournament engine manages brackets/round-robin with auto-room-creation. Discord bot posts notifications and streams audio to voice channels.

**Tech Stack:** Next.js 15, Puppeteer, WebSockets (ws/next-ws), Prisma + SQLite, Discord.js, Playwright (testing), esbuild

**Spec:** `docs/superpowers/specs/2026-03-19-basket-random-completion-design.md`

---

## Phase 1: Fix the Foundation

### Task 1: Gitignore & Environment Setup

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Remove tracked data/ files from git**

```bash
git rm -r --cached data/
```

- [ ] **Step 2: Update .gitignore**

Add to `.gitignore`:
```
data/
*.db
*.db-journal
*.db-shm
*.db-wal
```

- [ ] **Step 3: Create .env.example**

```
DATABASE_URL="file:./dev.db"
HEADLESS=true
CHROMIUM=
DISCORD_TOKEN=
DISCORD_CHANNEL_ID=
DISCORD_VOICE_CHANNEL_ID=
TWITCH_STREAM_KEY=
NODE_ENV=development
PORT=9000
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore .env.example
git commit -m "chore: add data/ to gitignore, create .env.example"
```

---

### Task 2: Fix Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `app/lib/types.ts`

- [ ] **Step 1: Fix schema — rename oppponent, remove Socket model, add private field**

Replace the full `prisma/schema.prisma` with:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Room {
  id        String   @id
  host      String
  createdAt DateTime @default(now())
  name      String
  opponent  String?
  roundGoal Int      @default(3)
  rounds    String   @default("[]")
  wins0     Int      @default(0)
  wins1     Int      @default(0)
  started   Boolean  @default(false)
  scoreMax  Int      @default(10)
  tournament Boolean @default(false)
  private   Boolean  @default(false)
  score0    Int      @default(0)
  score1    Int      @default(0)
  winner    Int?
}
```

Note: Tournament models added in Phase 3. Keep schema minimal until needed.

- [ ] **Step 2: Reset database**

```bash
npx prisma db push --force-reset
npx prisma generate
```

- [ ] **Step 3: Align types.ts with schema**

Replace `app/lib/types.ts`:
```typescript
export interface Room {
  id: string
  name: string
  host: string
  opponent: string | null
  players: string[]    // derived: [host, opponent].filter(Boolean)
  createdAt: number
  scoreMax: number
  roundGoal: number
  tournament: boolean
  private: boolean
  started: boolean
  score0: number
  score1: number
  winner: number | null
  rounds: string
  wins0: number
  wins1: number
}

export interface CreateRoomParams {
  name: string
  host: string
  scoreMax: number
  roundGoal: number
  tournament: boolean
  tPassword: string
}
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma app/lib/types.ts
git commit -m "fix: correct schema typo, align types, remove Socket model"
```

---

### Task 3: Fix rooms.ts — Remove localStorage Hybrid

**Files:**
- Modify: `app/lib/rooms.ts`

- [ ] **Step 1: Rewrite rooms.ts to use API-only on client, Prisma on server**

Replace `app/lib/rooms.ts` with a clean implementation that:
- Server-side: uses `prisma` directly
- Client-side: uses `fetch('/api/rooms')` only — no localStorage fallback
- Removes artificial `setTimeout` delays
- Derives `players` from `[room.host, room.opponent].filter(Boolean)`
- Uses the updated `Room` interface field names (`host` not `createdBy`, `opponent` not `oppponent`)

Key functions to preserve: `getRooms`, `getRoomById`, `createRoom`, `joinRoom`, `leaveRoom`, `subscribeToRoomUpdates`

- [ ] **Step 2: Update all references to old field names**

Search and replace across components:
- `room.createdBy` → `room.host`
- `room.maxScore` → `room.scoreMax`
- `room.bestOf` → `room.roundGoal`

Files to check: `room-detail.tsx`, `room-list.tsx`, `create-room-form.tsx`, `game-container.tsx`

- [ ] **Step 3: Verify the app compiles**

```bash
npx next build
```
Expected: no type errors related to Room interface

- [ ] **Step 4: Commit**

```bash
git add app/lib/rooms.ts app/components/
git commit -m "refactor: remove localStorage hybrid, use API-only room management"
```

---

### Task 4: Fix Critical Bugs in room-detail.tsx

**Files:**
- Modify: `app/components/room-detail.tsx`

- [ ] **Step 1: Fix the push() bug at line 110**

Current (broken):
```typescript
      await leaveRoom(roomId, playerName)
      push("/rooms")
```

The `push` function is defined at line 237 but not in scope at line 110 in the `handleLeaveRoom` function. Actually it IS in scope (same component), but the issue is the function is defined after it's called. In JavaScript this works due to hoisting for function declarations, but this is a `function` declaration at line 237, so it is hoisted. However, examining more carefully: `push` at line 237 is a function declaration, and `handleLeaveRoom` at line 93 calls `push("/rooms")` at line 110. This should work. But the reviewer flagged it — verify and test.

Actually the real bug: `handleLeaveRoom` calls `push("/rooms")` at line 110, but for the host path (line 95-107), it calls `router.push("/rooms")` directly. The non-host path at line 110 calls the local `push()` function which shows a confirm dialog. Make both paths consistent — use the local `push()` for both.

- [ ] **Step 2: Fix memory leaks — setInterval without cleanup**

At line 80: `setInterval` in `useEffect` but `clearInterval` only called when room has 2 players. If component unmounts before that, the interval leaks.

Fix: store interval ref and clear in useEffect cleanup:
```typescript
useEffect(() => {
    if (!isJoined) return;
    const int = setInterval(async () => {
      if (room.players.length < 2) {
        setRoom(await getRoomById(roomId) as Room);
      } else {
        clearInterval(int);
      }
    }, 1000);
    return () => clearInterval(int);
  }, [isJoined]);
```

At line 153: `setInterval(() => ping(), 1000)` — no cleanup at all. Fix:
```typescript
const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
// In the effect:
if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
pingIntervalRef.current = setInterval(() => ping(), 1000);
// In cleanup:
return () => {
  if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
};
```

- [ ] **Step 3: Fix window.onbeforeunload at line 232**

Replace:
```typescript
useEffect(() => {
    window.onbeforeunload = function () {
      return "Are you sure you want to leave this page?";
    }
  }, []);
```

With:
```typescript
useEffect(() => {
    const handler = () => "Are you sure you want to leave this page?";
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
```

- [ ] **Step 4: Remove debug console.logs**

Remove:
- Line 49: `console.log('eeeee')` in game-container.tsx
- Line 81: `console.log(room.players.length)` in room-detail.tsx
- Line 124: `console.log("Socket close attempt")` in room-detail.tsx
- Line 129: `console.log("Socket opened")` in room-detail.tsx
- Line 179: `console.log("Socket closed")` in room-detail.tsx

- [ ] **Step 5: Commit**

```bash
git add app/components/room-detail.tsx app/components/game-container.tsx
git commit -m "fix: memory leaks, push bug, cleanup debug logs in room components"
```

---

### Task 5: Clean Up headless/[id]/route.ts — Remove Stubs

**Files:**
- Modify: `app/api/headless/[id]/route.ts`

- [ ] **Step 1: Remove Discord bot stub (lines 8-9, 15-36, 738)**

Remove:
```typescript
import { Client } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
```
And the entire `client` initialization block (lines 15-36) and `client.login("")` at line 738.

- [ ] **Step 2: Mark duplicate compress function for removal**

The `compress()` function (lines 545-626) is duplicated from `public/client/compression.js`. **Do NOT remove it yet** — it's still used by `sendData` calls at lines 447, 465, 499. It will be deleted when Task 12 replaces the entire data channel with binary protocol. Add a `// TODO: Remove when binary protocol is implemented (Task 12)` comment above it.

- [ ] **Step 3: Add env-based headless toggle (line 652)**

Replace:
```typescript
headless: false,
```
With:
```typescript
headless: process.env.HEADLESS !== 'false' ? 'new' : false,
```

- [ ] **Step 4: Remove commented-out code blocks**

Delete:
- Lines 280-284 (commented setTimeout)
- Lines 331-341 (commented screenshot interval)
- Lines 683-686 (commented stream code)
- Lines 742-785 (commented proxy SOCKET handler)

- [ ] **Step 5: Use Prisma singleton instead of new instance**

Replace lines 12-13:
```typescript
const prisma = new PrismaClient();
const conn = prisma.$connect();
```
With:
```typescript
import prisma from "@/lib/prisma";
```
Remove the `await conn;` at line 55 (no longer needed with singleton).

- [ ] **Step 6: Commit**

```bash
git add app/api/headless/[id]/route.ts
git commit -m "chore: remove Discord stub, duplicate compress, dead code from headless route"
```

---

### Task 6: Clean Up offline-game.tsx and Other Files

**Files:**
- Modify: `app/components/offline-game.tsx`
- Modify: `app/api/rooms/route.ts`
- Modify: `app/api/rooms/[id]/route.ts`
- Modify: `app/api/lobby/[id]/route.ts`

- [ ] **Step 1: Remove cancer() function from offline-game.tsx**

Delete the `cancer()` function (lines 64-85 approximately) and its debug console.log.

- [ ] **Step 2: Remove debug console.logs from API routes**

- `app/api/rooms/route.ts` line 48: remove `console.log('New room created:', newRoom)`
- `app/api/rooms/[id]/route.ts` line 36: remove `console.log('put')`
- `app/api/lobby/[id]/route.ts`: remove debug console statements at lines 29, 51, 62, 120
- `app/rooms/create/page.tsx` line 25: remove `console.log(e.currentTarget.tournament[1].checked)`

- [ ] **Step 3: Update API routes for renamed fields**

In `app/api/rooms/route.ts` and `app/api/rooms/[id]/route.ts`, update any references from `oppponent` to `opponent`.

- [ ] **Step 4: Commit**

```bash
git add app/components/offline-game.tsx app/api/ app/rooms/
git commit -m "chore: remove dead code and debug logs from components and API routes"
```

---

### Task 7: Add Disconnect/Reconnect Handling to Headless Route

**Files:**
- Modify: `app/api/headless/[id]/route.ts`

- [ ] **Step 1: Add WebSocket close handler in SOCKET function**

After `sockets.push(client)` (line 62), add:
```typescript
client.addEventListener('close', () => {
    const idx = sockets.indexOf(client);
    if (idx !== -1) sockets.splice(idx, 1);
    console.log(`Client disconnected from lobby: ${lobbyId}`);
});
```

- [ ] **Step 2: Add disconnect detection in game loop**

In `createLobby`, after the game starts, add a periodic check for disconnected gamers:
```typescript
const disconnectCheck = setInterval(() => {
    gamers = gamers.filter(g => g.readyState === 1); // WebSocket.OPEN
    if (gamers.length === 0) {
        clearInterval(disconnectCheck);
        page.close().catch(() => {});
    } else if (gamers.length < 2 && !paused) {
        pause();
        // 30 second reconnect window
        setTimeout(() => {
            if (gamers.filter(g => g.readyState === 1).length < 2) {
                // Forfeit: remaining player wins
                const remaining = gamers.find(g => g.readyState === 1);
                if (remaining) {
                    sendData('end[' + (clients().indexOf(remaining) === 0 ? 0 : 1) + ']');
                }
                page.close().catch(() => {});
                clearInterval(disconnectCheck);
            }
        }, 30000);
    }
}, 2000);
```

- [ ] **Step 3: Add page cleanup on game end**

After `sendData('end[0]')` and `sendData('end[1]')` in `addRound`, add:
```typescript
setTimeout(() => {
    page.close().catch(() => {});
}, 5000); // Give clients time to receive the end message
```

- [ ] **Step 4: Commit**

```bash
git add app/api/headless/[id]/route.ts
git commit -m "feat: add disconnect handling and page cleanup to headless route"
```

---

## Phase 2: Multiplayer Netcode Revamp

### Task 8: Create Binary Protocol Library (Server-Side)

**Files:**
- Create: `app/lib/netcode.ts`

- [ ] **Step 1: Define packet types and constants**

```typescript
// Packet types
export const PACKET = {
  SNAPSHOT: 0x01,
  DELTA: 0x02,
  INPUT: 0x03,
  PING: 0x04,
  PONG: 0x04,  // same type, differentiated by direction
  EVENT: 0x05,
} as const;

// Snapshot field count for bitmask (must fit in uint32)
export const FIELD_COUNT = 18;

// Header size: 1 (type) + 4 (seq) + 4 (timestamp) = 9 bytes
export const HEADER_SIZE = 9;
```

- [ ] **Step 2: Implement encodeSnapshot**

Takes the flat game state object, returns an ArrayBuffer:
```typescript
export interface GameState {
  p0x: number; p0y: number; p0angle: number;
  p0velX: number; p0velY: number; p0armAngle: number;
  p1x: number; p1y: number; p1angle: number;
  p1velX: number; p1velY: number; p1armAngle: number;
  ballX: number; ballY: number; ballAngle: number;
  ballVelX: number; ballVelY: number;
  ballHolder: number;  // 0=none, 1=p0, 2=p1
  score0: number; score1: number;
  flags: number;  // bits: gameRunning, p0Up, p1Up
}

export function encodeSnapshot(seq: number, state: GameState): Buffer {
  const buf = Buffer.alloc(HEADER_SIZE + 39);
  let offset = 0;

  // Header
  buf.writeUInt8(PACKET.SNAPSHOT, offset++);
  buf.writeUInt32BE(seq, offset); offset += 4;
  buf.writeUInt32BE(Date.now() & 0xFFFFFFFF, offset); offset += 4;

  // Payload: fixed-point int16 for positions (x100), angles (x1000)
  const fields = [
    state.p0x * 100, state.p0y * 100, state.p0angle * 1000,
    state.p0velX * 100, state.p0velY * 100, state.p0armAngle * 1000,
    state.p1x * 100, state.p1y * 100, state.p1angle * 1000,
    state.p1velX * 100, state.p1velY * 100, state.p1armAngle * 1000,
    state.ballX * 100, state.ballY * 100, state.ballAngle * 1000,
    state.ballVelX * 100, state.ballVelY * 100,
  ];

  for (const val of fields) {
    buf.writeInt16BE(Math.round(val), offset); offset += 2;
  }

  buf.writeUInt8(state.ballHolder, offset++);
  buf.writeUInt8(state.score0, offset++);
  buf.writeUInt8(state.score1, offset++);
  buf.writeUInt8(state.flags, offset++);

  return buf;
}
```

- [ ] **Step 3: Implement encodeDelta**

```typescript
export function encodeDelta(seq: number, prev: GameState, curr: GameState): Buffer | null {
  const prevFields = stateToFields(prev);
  const currFields = stateToFields(curr);

  let bitmask = 0;
  const changedValues: number[] = [];

  for (let i = 0; i < FIELD_COUNT; i++) {
    if (prevFields[i] !== currFields[i]) {
      bitmask |= (1 << i);
      changedValues.push(currFields[i]);
    }
  }

  if (bitmask === 0) return null; // No changes

  const payloadSize = changedValues.length * 2 + 4; // 4 for uint32 bitmask
  const buf = Buffer.alloc(HEADER_SIZE + payloadSize);
  let offset = 0;

  buf.writeUInt8(PACKET.DELTA, offset++);
  buf.writeUInt32BE(seq, offset); offset += 4;
  buf.writeUInt32BE(Date.now() & 0xFFFFFFFF, offset); offset += 4;
  buf.writeUInt32BE(bitmask, offset); offset += 4;

  for (const val of changedValues) {
    buf.writeInt16BE(Math.round(val), offset); offset += 2;
  }

  return buf;
}

function stateToFields(s: GameState): number[] {
  return [
    s.p0x * 100, s.p0y * 100, s.p0angle * 1000,
    s.p0velX * 100, s.p0velY * 100, s.p0armAngle * 1000,
    s.p1x * 100, s.p1y * 100, s.p1angle * 1000,
    s.p1velX * 100, s.p1velY * 100, s.p1armAngle * 1000,
    s.ballX * 100, s.ballY * 100, s.ballAngle * 1000,
    s.ballVelX * 100, s.ballVelY * 100,
    s.ballHolder,
  ];
}
```

- [ ] **Step 4: Implement encodeEvent**

```typescript
export function encodeEvent(seq: number, eventType: string, data: Record<string, number>): Buffer {
  const json = JSON.stringify({ type: eventType, ...data });
  const payload = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(HEADER_SIZE);
  let offset = 0;

  header.writeUInt8(PACKET.EVENT, offset++);
  header.writeUInt32BE(seq, offset); offset += 4;
  header.writeUInt32BE(Date.now() & 0xFFFFFFFF, offset); offset += 4;

  return Buffer.concat([header, payload]);
}
```

- [ ] **Step 5: Commit**

```bash
git add app/lib/netcode.ts
git commit -m "feat: add binary protocol encoder for game state snapshots and deltas"
```

---

### Task 9: Create Binary Protocol Decoder (Client-Side)

**Files:**
- Create: `public/client/protocol.js`

- [ ] **Step 1: Implement client-side binary decoder**

```javascript
export const PACKET = {
  SNAPSHOT: 0x01,
  DELTA: 0x02,
  INPUT: 0x03,
  PING: 0x04,
  EVENT: 0x05,
};

const FIELD_NAMES = [
  'p0x', 'p0y', 'p0angle', 'p0velX', 'p0velY', 'p0armAngle',
  'p1x', 'p1y', 'p1angle', 'p1velX', 'p1velY', 'p1armAngle',
  'ballX', 'ballY', 'ballAngle', 'ballVelX', 'ballVelY',
  'ballHolder',
];

const DIVISORS = [
  100, 100, 1000, 100, 100, 1000,
  100, 100, 1000, 100, 100, 1000,
  100, 100, 1000, 100, 100,
  1, // ballHolder is integer
];

export function decodePacket(buffer) {
  const view = new DataView(buffer);
  const type = view.getUint8(0);
  const seq = view.getUint32(1);
  const timestamp = view.getUint32(5);

  switch (type) {
    case PACKET.SNAPSHOT:
      return { type, seq, timestamp, state: decodeSnapshot(view) };
    case PACKET.DELTA:
      return { type, seq, timestamp, ...decodeDelta(view) };
    case PACKET.EVENT:
      return { type, seq, timestamp, event: decodeEvent(buffer) };
    case PACKET.PING:
      return { type, seq, timestamp };
    default:
      return { type, seq, timestamp };
  }
}

function decodeSnapshot(view) {
  const state = {};
  let offset = 9; // after header

  for (let i = 0; i < 17; i++) {
    state[FIELD_NAMES[i]] = view.getInt16(offset) / DIVISORS[i];
    offset += 2;
  }

  state.ballHolder = view.getUint8(offset++);
  state.score0 = view.getUint8(offset++);
  state.score1 = view.getUint8(offset++);
  state.flags = view.getUint8(offset++);

  return state;
}

function decodeDelta(view) {
  let offset = 9;
  const bitmask = view.getUint32(offset); offset += 4;
  const changes = {};

  for (let i = 0; i < 18; i++) {
    if (bitmask & (1 << i)) {
      changes[FIELD_NAMES[i]] = view.getInt16(offset) / DIVISORS[i];
      offset += 2;
    }
  }

  return { bitmask, changes };
}

function decodeEvent(buffer) {
  const json = new TextDecoder().decode(buffer.slice(9));
  return JSON.parse(json);
}

export function encodeInput(playerIndex, keyAction, timestamp) {
  const buf = new ArrayBuffer(15);
  const view = new DataView(buf);
  view.setUint8(0, PACKET.INPUT);
  view.setUint32(1, 0); // seq (client doesn't track)
  view.setUint32(5, timestamp & 0xFFFFFFFF);
  view.setUint8(9, playerIndex);
  view.setUint8(10, keyAction); // 0=release, 1=press
  return buf;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/client/protocol.js
git commit -m "feat: add client-side binary protocol decoder"
```

---

### Task 10: Create Interpolation Buffer (Client-Side)

**Files:**
- Create: `public/client/interpolation.js`

- [ ] **Step 1: Implement interpolation buffer and lerp utilities**

```javascript
const INTERP_DELAY = 50; // ms behind real-time

export function createStateBuffer(capacity = 10) {
  const buffer = [];
  let latestState = null;

  return {
    push(state, receivedAt = performance.now()) {
      buffer.push({ state, receivedAt });
      latestState = state;
      if (buffer.length > capacity) buffer.shift();
    },

    interpolate() {
      if (buffer.length < 2) return latestState;

      const renderTime = performance.now() - INTERP_DELAY;

      // Find bracketing states
      let a = buffer[0], b = buffer[1];
      for (let i = 1; i < buffer.length; i++) {
        if (buffer[i].receivedAt > renderTime) {
          b = buffer[i];
          a = buffer[i - 1];
          break;
        }
        // If all states are older than renderTime, use the last two
        if (i === buffer.length - 1) {
          a = buffer[i - 1];
          b = buffer[i];
        }
      }

      const range = b.receivedAt - a.receivedAt;
      const t = range > 0 ? Math.max(0, Math.min(1, (renderTime - a.receivedAt) / range)) : 1;

      return lerpState(a.state, b.state, t);
    },

    get latest() { return latestState; },
    get length() { return buffer.length; },
  };
}

function lerpState(a, b, t) {
  return {
    p0x: lerp(a.p0x, b.p0x, t),
    p0y: lerp(a.p0y, b.p0y, t),
    p0angle: lerpAngle(a.p0angle, b.p0angle, t),
    p0velX: lerp(a.p0velX, b.p0velX, t),
    p0velY: lerp(a.p0velY, b.p0velY, t),
    p0armAngle: lerpAngle(a.p0armAngle, b.p0armAngle, t),
    p1x: lerp(a.p1x, b.p1x, t),
    p1y: lerp(a.p1y, b.p1y, t),
    p1angle: lerpAngle(a.p1angle, b.p1angle, t),
    p1velX: lerp(a.p1velX, b.p1velX, t),
    p1velY: lerp(a.p1velY, b.p1velY, t),
    p1armAngle: lerpAngle(a.p1armAngle, b.p1armAngle, t),
    ballX: lerp(a.ballX, b.ballX, t),
    ballY: lerp(a.ballY, b.ballY, t),
    ballAngle: lerpAngle(a.ballAngle, b.ballAngle, t),
    ballVelX: lerp(a.ballVelX, b.ballVelX, t),
    ballVelY: lerp(a.ballVelY, b.ballVelY, t),
    ballHolder: b.ballHolder, // no lerp for discrete values
    score0: b.score0,
    score1: b.score1,
    flags: b.flags,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  // Shortest path interpolation
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export { lerp, lerpAngle };
```

- [ ] **Step 2: Commit**

```bash
git add public/client/interpolation.js
git commit -m "feat: add interpolation buffer with lerp for smooth state rendering"
```

---

### Task 11: Rewrite tick.js — Interpolation-Based Rendering

**Files:**
- Modify: `public/client/tick.js`

- [ ] **Step 1: Rewrite tick.js**

Replace the entire file. The new tick function receives an interpolated state and applies it to C3 objects:

```javascript
export function applyState(window, state) {
  if (!state || !window.players || !window.ball) return;

  try {
    // Update score UI
    const ui = window.c3_runtimeInterface._localRuntime._layoutManager
      ._layoutsByName.get('game')._layersByName.get('ui')._instances;
    ui[2]._sdkInst._SetText(String(state.score1));
    ui[3]._sdkInst._SetText(String(state.score0));
  } catch {}

  // Apply player 0 (body, body2 = two parts of player 0)
  const p0 = window.players[0];
  const p1 = window.players[1];
  // players array: [body(p0-lower), body2(p0-upper?), body3(p1-lower), body4(p1-upper?)]
  // Based on the C3 object naming, body/body2 = player 0, body3/body4 = player 1

  if (p0) {
    p0.x = state.p0x;
    p0.y = state.p0y;
    p0.angle = state.p0angle;
    p0.behaviors.Physics.angularVelocity = 0;
  }
  if (p1) {
    p1.x = state.p0x; // body2 follows body
    p1.y = state.p0y;
  }

  const p2 = window.players[2];
  const p3 = window.players[3];
  if (p2) {
    p2.x = state.p1x;
    p2.y = state.p1y;
    p2.angle = state.p1angle;
    p2.behaviors.Physics.angularVelocity = 0;
  }
  if (p3) {
    p3.x = state.p1x;
    p3.y = state.p1y;
  }

  // Apply arms
  const arms = window.arms;
  if (arms[0]) {
    arms[0].x = arms[0].x; // arms follow player position
    arms[0].angle = state.p0armAngle;
  }
  if (arms[2]) {
    arms[2].angle = state.p1armAngle;
  }

  // Apply ball
  const ball = window.ball;
  if (ball) {
    ball.x = state.ballX;
    ball.y = state.ballY;
    ball.angle = state.ballAngle;
    if (state.ballHolder !== undefined) {
      ball.instVars.hold = state.ballHolder > 0;
      ball.instVars.who = state.ballHolder;
    }
  }
}
```

Note: The exact mapping of players[0-3] to p0/p1 body parts needs verification via Playwright testing. The current code maps 4 body objects + 4 arms. The new binary protocol flattens this to p0/p1 only. The server extraction (Task 12) needs to send the primary body position for each player.

- [ ] **Step 2: Commit**

```bash
git add public/client/tick.js
git commit -m "feat: rewrite tick.js to apply interpolated state directly to C3 objects"
```

---

### Task 12: Rewrite Headless Route — New Data Channel + Binary Protocol

**Files:**
- Modify: `app/api/headless/[id]/route.ts`

This is the largest task. The headless route needs to:
1. Replace `console.log` data channel with `page.exposeFunction`
2. Use binary protocol for state transmission
3. Keep the existing audio hook for scoring
4. Keep the existing game init flow (click menu, wait, click start)

- [ ] **Step 1: Add netcode imports**

```typescript
import { encodeSnapshot, encodeDelta, encodeEvent, type GameState, PACKET } from "@/lib/netcode";
```

- [ ] **Step 2: Replace the console.log data extraction (lines 490-542)**

Remove the `browser.page.on('console')` handler and the `page.evaluate` that sets up `setInterval` with `console.log`.

Replace with `page.exposeFunction`:

```typescript
let lastState: GameState | null = null;
let seq = 0;

// Expose callback from page → Node
await page.exposeFunction('__sendState', (flatState: number[]) => {
    if (paused) return;

    const state: GameState = {
      p0x: flatState[0], p0y: flatState[1], p0angle: flatState[2],
      p0velX: flatState[3], p0velY: flatState[4], p0armAngle: flatState[5],
      p1x: flatState[6], p1y: flatState[7], p1angle: flatState[8],
      p1velX: flatState[9], p1velY: flatState[10], p1armAngle: flatState[11],
      ballX: flatState[12], ballY: flatState[13], ballAngle: flatState[14],
      ballVelX: flatState[15], ballVelY: flatState[16],
      ballHolder: flatState[17],
      score0: flatState[18], score1: flatState[19],
      flags: flatState[20],
    };

    seq++;

    // Send full snapshot every 300 frames (~5 sec at 60Hz) or if no lastState
    let packet: Buffer;
    if (!lastState || seq % 300 === 0) {
      packet = encodeSnapshot(seq, state);
    } else {
      const delta = encodeDelta(seq, lastState, state);
      packet = delta || encodeSnapshot(seq, state);
    }

    lastState = state;

    // Send binary to all gamers
    for (const gamer of gamers) {
      if (gamer.readyState === 1) {
        gamer.send(packet);
      }
    }
});
```

- [ ] **Step 3: Inject state extraction into C3 page**

Replace the old `page.evaluate` (that set up console.log interval) with:

```typescript
await page.evaluate(() => {
    const win = window as any;
    setInterval(() => {
      try {
        const p0 = win.players[0];
        const p1 = win.players[2]; // body3 = player 1
        const ball = win.ball;
        const arm0 = win.arms[0];
        const arm1 = win.arms[2];
        const p0vel = p0.behaviors.Physics.getVelocity();
        const p1vel = p1.behaviors.Physics.getVelocity();
        const ballVel = ball.behaviors.Physics.getVelocity();

        win.__sendState([
          p0.x, p0.y, p0.angle,
          p0vel[0], p0vel[1], arm0.angle,
          p1.x, p1.y, p1.angle,
          p1vel[0], p1vel[1], arm1.angle,
          ball.x, ball.y, ball.angle,
          ballVel[0], ballVel[1],
          ball.instVars.hold ? ball.instVars.who : 0,
          win.score.p1, win.score.p2,
          0, // flags
        ]);
      } catch {}
    }, 1000 / 60); // 60 Hz
});
```

- [ ] **Step 4: Update score check to use audio hook instead of polling**

The audio hook (`AudioDOMHandler._Play`) already detects goals and increments `win.score`. Now also send a score event immediately when it fires.

In the `page.evaluate` where `AudioDOMHandler._Play` is proxied (around line 234), add after the score increment:

```javascript
if (argumentsList[0].originalUrl === "file") {
    // ... existing score increment ...
    // Notify server of score change
    win.__sendState([ /* current state snapshot */ ]);
}
```

Also update the server-side score persistence: instead of checking every 100th message, check in the `__sendState` callback when score changes:

```typescript
// In __sendState callback:
if (lastState && (state.score0 !== lastState.score0 || state.score1 !== lastState.score1)) {
    prisma.room.update({
        where: { id },
        data: { score0: state.score0, score1: state.score1 }
    }).catch(() => {});

    const room = await roomInfo();
    if (state.score0 >= room.scoreMax) {
        await addRound(0);
    } else if (state.score1 >= room.scoreMax) {
        await addRound(1);
    }
}
```

- [ ] **Step 5: Update addRound to use binary events**

Replace `sendData('end[0]')` with:
```typescript
const endPacket = encodeEvent(seq++, 'end', { winner: 0 });
for (const gamer of gamers) gamer.send(endPacket);
```

Replace `sendData('round[...')` with:
```typescript
const roundPacket = encodeEvent(seq++, 'round', { round: rounds.length });
for (const gamer of gamers) gamer.send(roundPacket);
```

- [ ] **Step 6: Commit**

```bash
git add app/api/headless/[id]/route.ts
git commit -m "feat: replace console.log data channel with exposeFunction + binary protocol"
```

---

### Task 13: Rewrite main.js — Binary Protocol + Interpolation

**Files:**
- Modify: `public/client/main.js`

- [ ] **Step 1: Update imports**

```javascript
import { getSockets } from './sockets';
import { setup } from './setup';
import { decodePacket, encodeInput, PACKET } from './protocol';
import { createStateBuffer } from './interpolation';
import { applyState } from './tick';
import { anticheat } from './anticheat';
```

Remove imports for `compress`, `decompress`, `enumerate`, `ping`, `tick`.

- [ ] **Step 2: Rewrite the message handler**

Replace the nested `comms.in.addEventListener('message')` spaghetti (lines 116-308) with a clean binary handler:

```javascript
const stateBuffer = createStateBuffer();

comms.in.binaryType = 'arraybuffer';

comms.in.addEventListener('message', (event) => {
    // Handle text messages (legacy: 'loaded', 'start', 'coin flipped')
    if (typeof event.data === 'string') {
        handleTextMessage(event.data, cw, comms);
        return;
    }

    // Binary protocol
    const packet = decodePacket(event.data);

    switch (packet.type) {
        case PACKET.SNAPSHOT:
            stateBuffer.push(packet.state);
            break;
        case PACKET.DELTA:
            // Apply delta to latest state
            const latest = stateBuffer.latest;
            if (latest) {
                const updated = { ...latest, ...packet.changes };
                stateBuffer.push(updated);
            }
            break;
        case PACKET.EVENT:
            handleGameEvent(packet.event, cw);
            break;
    }
});
```

- [ ] **Step 3: Set up render loop using interpolation**

```javascript
function renderLoop() {
    const interpolated = stateBuffer.interpolate();
    if (interpolated) {
        applyState(cw, interpolated);
    }
    requestAnimationFrame(renderLoop);
}

// Start render loop after game starts
function onGameStart() {
    cw.c3_runtimeInterface._localRuntime.SetSuspended(false);
    document.querySelector('iframe').focus();
    requestAnimationFrame(renderLoop);
}
```

- [ ] **Step 4: Update input sending to use binary**

```javascript
cw.addEventListener('basket-key', (event) => {
    const { key, type } = event.detail;
    const playerIndex = key === 'ArrowUp' ? 0 : 1; // up = p0, w = p1
    const action = type === 'keydown' ? 1 : 0;
    const inputPacket = encodeInput(playerIndex, action, performance.now());
    comms.out.send(inputPacket);

    // Also forward to parent for UI indicators
    window.dispatchEvent(new event.constructor(event.type, event));
});
```

- [ ] **Step 5: Keep text message handler for non-game messages**

```javascript
function handleTextMessage(data, cw, comms) {
    if (data === 'loaded') {
        window.postMessage({ type: 'loaded' }, '*');
    }
    if (data === 'start') {
        window.postMessage({ type: 'start' }, '*');
    }
    if (data.startsWith('coin flipped: ')) {
        const side = parseInt(data.split('coin flipped: ')[1]);
        window.postMessage({ type: 'coinflip', phase: 'start' });
        cw.flipCoin("1", "2", "idk", side, () => {
            window.postMessage({ type: 'coinflip', phase: 'end' });
        });
    }
}

function handleGameEvent(event, cw) {
    if (event.type === 'end') {
        window.postMessage({ type: 'end', winner: event.winner }, '*');
    }
    if (event.type === 'round') {
        window.postMessage({ type: 'newround', data: event }, '*');
    }
    if (event.type === 'score') {
        window.postMessage({ type: 'score', data: [event.score0, event.score1] }, '*');
    }
}
```

- [ ] **Step 6: Delete compression.js**

```bash
rm public/client/compression.js
```

- [ ] **Step 7: Commit**

```bash
git add public/client/main.js public/client/tick.js
git rm public/client/compression.js
git commit -m "feat: integrate binary protocol and interpolation buffer into game client"
```

---

### Task 14: Add Connection Quality Indicator

**Files:**
- Modify: `app/components/ping-indicator.tsx` (already exists)

- [ ] **Step 1: Update ping indicator with color thresholds**

The component already exists. Verify it supports green/yellow/red based on RTT. If not, add:
- Green: `ping < 80`
- Yellow: `80 <= ping < 150`
- Red: `ping >= 150` or disconnected

- [ ] **Step 2: Commit**

```bash
git add app/components/ping-indicator.tsx
git commit -m "feat: add color-coded connection quality to ping indicator"
```

---

### Task 15: Playwright Tests — Netcode & Game Flow

**Files:**
- Create: `tests/rooms.spec.ts`
- Create: `tests/game-flow.spec.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:9000',
  },
  webServer: {
    command: 'node server.js',
    port: 9000,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Create rooms.spec.ts — basic room CRUD**

```typescript
import { test, expect } from '@playwright/test';

test('can create and list rooms', async ({ request }) => {
  const create = await request.post('/api/rooms', {
    data: { name: 'Test Room', host: 'Player1', scoreMax: 10, roundGoal: 3, tournament: false, tPassword: '' }
  });
  expect(create.ok()).toBeTruthy();

  const list = await request.get('/api/rooms');
  const rooms = await list.json();
  expect(rooms.length).toBeGreaterThan(0);
});
```

- [ ] **Step 4: Create game-flow.spec.ts — two players join and play**

```typescript
import { test, expect } from '@playwright/test';

test('two players can join a room', async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  // Player 1 creates room
  await p1.goto('/rooms/create');
  // Fill form and create...
  // Player 2 joins...
  // Assert both see 2 players connected

  await ctx1.close();
  await ctx2.close();
});
```

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/ package.json package-lock.json
git commit -m "test: add Playwright config and initial room/game-flow tests"
```

---

## Phase 3: Tournament System

### Task 16: Add Tournament Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Tournament, TournamentParticipant, TournamentMatch models**

Append to schema.prisma (after Room model):

```prisma
model Tournament {
  id          String   @id @default(cuid())
  name        String
  format      String
  status      String   @default("registration")
  streamed    Boolean  @default(false)
  private     Boolean  @default(false)
  maxPlayers  Int      @default(8)
  createdAt   DateTime @default(now())
  createdBy   String

  participants TournamentParticipant[]
  matches      TournamentMatch[]
}

model TournamentParticipant {
  id           String     @id @default(cuid())
  tournamentId String
  playerName   String
  seed         Int?
  eliminated   Boolean    @default(false)
  wins         Int        @default(0)
  losses       Int        @default(0)
  joinedAt     DateTime   @default(now())

  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  matchesAsP0  TournamentMatch[] @relation("MatchPlayer0")
  matchesAsP1  TournamentMatch[] @relation("MatchPlayer1")
  matchesWon   TournamentMatch[] @relation("MatchWinner")
}

model TournamentMatch {
  id           String     @id @default(cuid())
  tournamentId String
  roomId       String?    @unique
  round        Int
  matchIndex   Int
  player0Id    String?
  player1Id    String?
  winnerId     String?
  status       String     @default("pending")

  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  room         Room?      @relation(fields: [roomId], references: [id])
  player0      TournamentParticipant? @relation("MatchPlayer0", fields: [player0Id], references: [id])
  player1      TournamentParticipant? @relation("MatchPlayer1", fields: [player1Id], references: [id])
  winner       TournamentParticipant? @relation("MatchWinner", fields: [winnerId], references: [id])
}
```

Add back-relation to Room:
```prisma
model Room {
  // ... existing fields ...
  tournamentMatch TournamentMatch?
}
```

- [ ] **Step 2: Push schema**

```bash
npx prisma db push --force-reset
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Tournament, TournamentParticipant, TournamentMatch models"
```

---

### Task 17: Tournament Engine — Bracket Generation

**Files:**
- Create: `app/lib/tournament.ts`

- [ ] **Step 1: Implement bracket generation**

```typescript
import prisma from "./prisma";

export async function generateBracket(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { participants: true },
  });
  if (!tournament) throw new Error("Tournament not found");

  const players = [...tournament.participants];
  // Shuffle for random seeding
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  // Calculate rounds needed
  const totalRounds = Math.ceil(Math.log2(players.length));
  const bracketSize = Math.pow(2, totalRounds);

  // First round matches (with byes)
  const matches = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const p0 = players[i * 2] || null;
    const p1 = players[i * 2 + 1] || null;

    matches.push({
      tournamentId,
      round: 1,
      matchIndex: i,
      player0Id: p0?.id || null,
      player1Id: p1?.id || null,
      status: (!p0 || !p1) ? 'completed' : 'pending', // bye = auto-advance
      winnerId: !p1 ? p0?.id : (!p0 ? p1?.id : null),
    });
  }

  // Create placeholder matches for subsequent rounds
  let matchesInRound = bracketSize / 4;
  for (let round = 2; round <= totalRounds; round++) {
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        tournamentId,
        round,
        matchIndex: i,
        player0Id: null,
        player1Id: null,
        status: 'pending',
        winnerId: null,
      });
    }
    matchesInRound /= 2;
  }

  await prisma.tournamentMatch.createMany({ data: matches });

  // Auto-advance byes
  const byeMatches = matches.filter(m => m.status === 'completed' && m.winnerId);
  for (const bye of byeMatches) {
    await advanceWinner(tournamentId, bye.round, bye.matchIndex, bye.winnerId!);
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'in_progress' },
  });
}
```

- [ ] **Step 2: Implement advanceWinner**

```typescript
export async function advanceWinner(tournamentId: string, round: number, matchIndex: number, winnerId: string) {
  const nextRound = round + 1;
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const isPlayer0 = matchIndex % 2 === 0;

  const nextMatch = await prisma.tournamentMatch.findFirst({
    where: { tournamentId, round: nextRound, matchIndex: nextMatchIndex },
  });

  if (!nextMatch) {
    // This was the final — tournament complete
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'completed' },
    });
    return;
  }

  await prisma.tournamentMatch.update({
    where: { id: nextMatch.id },
    data: isPlayer0 ? { player0Id: winnerId } : { player1Id: winnerId },
  });
}
```

- [ ] **Step 3: Implement completeMatch (called when a room game ends)**

```typescript
export async function completeMatch(roomId: string, winnerIndex: number) {
  const match = await prisma.tournamentMatch.findFirst({
    where: { roomId },
    include: { player0: true, player1: true, tournament: true },
  });
  if (!match) return; // Not a tournament match

  const winnerId = winnerIndex === 0 ? match.player0Id : match.player1Id;
  const loserId = winnerIndex === 0 ? match.player1Id : match.player0Id;

  if (!winnerId) return;

  await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: { winnerId, status: 'completed' },
  });

  // Update participant stats
  if (winnerId) {
    await prisma.tournamentParticipant.update({
      where: { id: winnerId },
      data: { wins: { increment: 1 } },
    });
  }
  if (loserId) {
    await prisma.tournamentParticipant.update({
      where: { id: loserId },
      data: { losses: { increment: 1 }, eliminated: true },
    });
  }

  // Advance winner
  await advanceWinner(match.tournamentId, match.round, match.matchIndex, winnerId);
}
```

- [ ] **Step 4: Implement round-robin generation**

```typescript
export async function generateRoundRobin(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { participants: true },
  });
  if (!tournament) throw new Error("Tournament not found");

  const players = [...tournament.participants];
  const n = players.length;
  const isOdd = n % 2 !== 0;
  if (isOdd) players.push(null as any); // bye player

  const total = players.length;
  const rounds = total - 1;
  const half = total / 2;
  const matches = [];

  const indices = players.map((_, i) => i);

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const p0 = players[indices[i]];
      const p1 = players[indices[total - 1 - i]];

      if (!p0 || !p1) continue; // skip bye

      matches.push({
        tournamentId,
        round: round + 1,
        matchIndex: i,
        player0Id: p0.id,
        player1Id: p1.id,
        status: 'pending',
      });
    }

    // Rotate: fix first, rotate rest
    const last = indices.pop()!;
    indices.splice(1, 0, last);
  }

  await prisma.tournamentMatch.createMany({ data: matches });
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'in_progress' },
  });
}
```

- [ ] **Step 5: Implement createMatchRoom (auto-creates Room for a tournament match)**

```typescript
export async function createMatchRoom(matchId: string) {
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { player0: true, player1: true, tournament: true },
  });
  if (!match || !match.player0 || !match.player1) return null;

  const roomId = Math.random().toString(36).substring(2, 10);
  const room = await prisma.room.create({
    data: {
      id: roomId,
      name: `${match.tournament.name}: ${match.player0.playerName} vs ${match.player1.playerName}`,
      host: match.player0.playerName,
      opponent: match.player1.playerName,
      tournament: true,
      private: match.tournament.private || match.tournament.streamed,
      scoreMax: 10,
      roundGoal: 3,
    },
  });

  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: { roomId, status: 'live' },
  });

  return room;
}
```

- [ ] **Step 6: Commit**

```bash
git add app/lib/tournament.ts
git commit -m "feat: tournament engine with bracket, round-robin generation, and match advancement"
```

---

### Task 18: Tournament API Routes

**Files:**
- Create: `app/api/tournaments/route.ts`
- Create: `app/api/tournaments/[id]/route.ts`

- [ ] **Step 1: Create tournament list + create endpoint**

`app/api/tournaments/route.ts`:
```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateBracket, generateRoundRobin } from "@/lib/tournament";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    include: { participants: true, matches: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(tournaments);
}

export async function POST(request: Request) {
  const body = await request.json();
  const tournament = await prisma.tournament.create({
    data: {
      name: body.name,
      format: body.format,
      maxPlayers: body.maxPlayers || 8,
      streamed: body.streamed || false,
      private: body.private || false,
      createdBy: body.createdBy,
    },
  });
  return NextResponse.json(tournament, { status: 201 });
}
```

- [ ] **Step 2: Create tournament detail/action endpoint**

`app/api/tournaments/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateBracket, generateRoundRobin, createMatchRoom } from "@/lib/tournament";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: true,
      matches: { include: { player0: true, player1: true, winner: true, room: true } },
    },
  });
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tournament);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  switch (body.action) {
    case 'join': {
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: id, playerName: body.playerName },
      });
      return NextResponse.json(participant, { status: 201 });
    }
    case 'leave': {
      await prisma.tournamentParticipant.deleteMany({
        where: { tournamentId: id, playerName: body.playerName },
      });
      return NextResponse.json({ ok: true });
    }
    case 'start': {
      const tournament = await prisma.tournament.findUnique({ where: { id } });
      if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (tournament.format === 'bracket') {
        await generateBracket(id);
      } else {
        await generateRoundRobin(id);
      }
      return NextResponse.json({ ok: true });
    }
    case 'create-room': {
      const room = await createMatchRoom(body.matchId);
      return NextResponse.json(room);
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/tournaments/
git commit -m "feat: tournament API routes for CRUD, join, start, room creation"
```

---

### Task 19: Tournament UI Pages

**Files:**
- Create: `app/tournaments/page.tsx`
- Create: `app/tournaments/create/page.tsx`
- Create: `app/tournaments/[id]/page.tsx`
- Create: `app/components/bracket-view.tsx`

- [ ] **Step 1: Create tournament list page**

`app/tournaments/page.tsx` — fetches `/api/tournaments`, displays cards with name, format, status, player count, join button.

- [ ] **Step 2: Create tournament creation page**

`app/tournaments/create/page.tsx` — form with: name, format (bracket/round_robin dropdown), max players, streamed toggle, private toggle.

- [ ] **Step 3: Create tournament detail page**

`app/tournaments/[id]/page.tsx` — shows:
- Tournament info header (name, format, status)
- Participant list with join/leave
- Start button (for creator, when enough players)
- Bracket view (if format=bracket) or standings table (if round_robin)
- "Join Match" button for ready matches

- [ ] **Step 4: Create bracket visualization component**

`app/components/bracket-view.tsx` — renders single-elimination bracket:
- Rounds as columns (left to right)
- Matches as cards with player names
- Lines connecting matches to next round
- Live/completed status badges

- [ ] **Step 5: Wire tournament completion into headless route**

In `app/api/headless/[id]/route.ts`, after setting `winner` on room:
```typescript
import { completeMatch } from "@/lib/tournament";
// After: await prisma.room.update({ where: { id }, data: { winner: 0 } })
await completeMatch(id, 0);
```

- [ ] **Step 6: Add navigation links**

Add "Tournaments" link to `app/page.tsx` home page and any navigation component.

- [ ] **Step 7: Commit**

```bash
git add app/tournaments/ app/components/bracket-view.tsx app/page.tsx app/api/headless/
git commit -m "feat: tournament UI with bracket view, list, create, detail pages"
```

---

### Task 20: Streamed Tournament Mode

**Files:**
- Modify: `app/api/headless/[id]/route.ts`

- [ ] **Step 1: Enable Puppeteer stream for tournament rooms**

In the `run()` function, after page creation, conditionally enable stream:
```typescript
let stream = null;
if (roomInfo && (await roomInfo()).tournament && (await roomInfo()).private) {
    try {
        stream = await getStream(page, { audio: true, video: true, bitsPerSecond: 1000000, frameSize: 8 });
    } catch {
        console.warn('Could not get stream for tournament match');
    }
}
```

- [ ] **Step 2: Pipe to Twitch when TWITCH_STREAM_KEY is set**

```typescript
if (stream && process.env.TWITCH_STREAM_KEY) {
    const { startStreaming } = await import('twitch-stream-video');
    startStreaming(stream).catch(() => {});
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/headless/[id]/route.ts
git commit -m "feat: enable Puppeteer streaming for tournament matches"
```

---

## Phase 4: Discord Integration

### Task 21: Discord Bot Module

**Files:**
- Create: `app/lib/discord.ts`
- Modify: `server.js`

- [ ] **Step 1: Create Discord singleton with notify function**

```typescript
import { Client, GatewayIntentBits, EmbedBuilder, TextChannel } from 'discord.js';

let client: Client | null = null;
let ready = false;

export function initDiscord() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return;

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  client.once('ready', () => {
    ready = true;
    console.log(`Discord bot logged in as ${client!.user?.tag}`);
  });

  client.login(token).catch((err) => {
    console.warn('Discord login failed:', err.message);
    client = null;
  });
}

export async function notify(event: string, data: Record<string, any>) {
  if (!client || !ready) return;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId) as TextChannel;
  if (!channel) return;

  const embed = new EmbedBuilder().setColor(0xFF6B35); // basketball orange

  switch (event) {
    case 'room_created':
      embed.setTitle('New Room').setDescription(`**${data.host}** created room **${data.name}**`);
      break;
    case 'match_started':
      embed.setTitle('Match Started').setDescription(`**${data.p0}** vs **${data.p1}**`);
      break;
    case 'match_ended':
      embed.setTitle('Match Ended').setDescription(`**${data.winner}** wins! Final: ${data.score}`);
      break;
    case 'tournament_created':
      embed.setTitle('Tournament Open').setDescription(`**${data.name}** — ${data.format}, ${data.maxPlayers} slots`);
      break;
    case 'tournament_winner':
      embed.setTitle('Tournament Champion').setDescription(`**${data.winner}** wins **${data.name}**!`);
      break;
    default:
      embed.setDescription(JSON.stringify(data));
  }

  await channel.send({ embeds: [embed] }).catch(() => {});
}

export function getDiscordClient() { return client; }
```

- [ ] **Step 2: Initialize Discord in server.js**

Since `server.js` is plain JS and cannot import `.ts` files directly, trigger Discord init via a dynamic import through Next.js compilation. Add a new API route `app/api/discord-init/route.ts`:

```typescript
import { initDiscord } from "@/lib/discord";
initDiscord(); // Side-effect on import
export function GET() { return new Response("ok"); }
```

Then in `server.js`, after the server starts, call it:
```javascript
.listen(port, () => {
    console.log(` ▲ Ready on http://${hostname}:${port}`);
    // Trigger Discord bot init via API route side-effect
    fetch(`http://localhost:${port}/api/discord-init`).catch(() => {});
});
```

- [ ] **Step 3: Add notify calls in relevant routes**

In room creation API: `notify('room_created', { host, name })`
In headless route on game end: `notify('match_ended', { winner, score })`
In tournament engine on completion: `notify('tournament_winner', { winner, name })`

- [ ] **Step 4: Commit**

```bash
git add app/lib/discord.ts server.js
git commit -m "feat: Discord bot with notification system"
```

---

### Task 22: Discord Voice Channel Streaming

**Files:**
- Modify: `app/lib/discord.ts`

- [ ] **Step 1: Add voice streaming functions**

```typescript
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';

let voiceConnection: any = null;

export async function startVoiceStream(stream: any) {
  if (!client || !ready) return;
  const vcId = process.env.DISCORD_VOICE_CHANNEL_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!vcId || !guildId) return;

  const guild = await client.guilds.fetch(guildId);
  voiceConnection = joinVoiceChannel({
    channelId: vcId,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  const resource = createAudioResource(stream);
  player.play(resource);
  voiceConnection.subscribe(player);
}

export function stopVoiceStream() {
  if (voiceConnection) {
    voiceConnection.destroy();
    voiceConnection = null;
  }
}
```

- [ ] **Step 2: Wire into headless route for streamed tournaments**

After stream is created for a tournament match:
```typescript
if (stream && process.env.DISCORD_VOICE_CHANNEL_ID) {
    const { startVoiceStream } = await import("@/lib/discord");
    startVoiceStream(stream);
}
```

On game end:
```typescript
const { stopVoiceStream } = await import("@/lib/discord");
stopVoiceStream();
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/discord.ts app/api/headless/
git commit -m "feat: Discord voice channel streaming for tournament matches"
```

---

## Phase 5: Polish & Deploy Prep

### Task 23: Error Boundaries & UI Polish

**Files:**
- Create: `app/components/error-boundary.tsx`
- Modify: `app/components/game-container.tsx`
- Modify: `app/rooms/[id]/page.tsx`

- [ ] **Step 1: Create error boundary component**

```typescript
"use client"
import { Component, type ReactNode } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-red-500 mb-4">Something went wrong</p>
            <Button onClick={() => this.setState({ hasError: false })}>Try Again</Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap game container and room detail in error boundaries**

In `app/rooms/[id]/page.tsx`:
```tsx
<ErrorBoundary>
  <RoomDetail roomId={id} initialRoom={room} />
</ErrorBoundary>
```

- [ ] **Step 3: Commit**

```bash
git add app/components/error-boundary.tsx app/rooms/
git commit -m "feat: add error boundaries around game and room components"
```

---

### Task 24: Environment Validation & Deploy Config

**Files:**
- Create: `Dockerfile`
- Create: `fly.toml`
- Modify: `server.js`

- [ ] **Step 1: Add env validation to server.js**

```javascript
// At top of server.js, after imports:
const requiredEnv = ['DATABASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npx prisma generate
RUN npx next build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
```

- [ ] **Step 3: Create fly.toml**

```toml
app = "basket-random"
primary_region = "iad"

[build]

[env]
  NODE_ENV = "production"
  PORT = "8080"
  DATABASE_URL = "file:/data/prod.db"
  HEADLESS = "true"

[mounts]
  source = "data"
  destination = "/data"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 100
    soft_limit = 50

  [[services.http_checks]]
    interval = 10000
    timeout = 2000
    path = "/api/ping"
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile fly.toml server.js
git commit -m "feat: add Dockerfile and fly.toml for Fly.io deployment"
```

---

### Task 25: Final Playwright Integration Tests

**Files:**
- Create: `tests/tournament.spec.ts`
- Modify: `tests/game-flow.spec.ts`

- [ ] **Step 1: Add tournament test**

Test creating a tournament, registering 4 players, starting it, verifying bracket is generated with correct match count.

- [ ] **Step 2: Expand game-flow test**

Test the full lifecycle:
1. Create room via API
2. Two browser contexts join
3. Both click "ready"
4. Verify game starts (countdown appears)
5. Verify binary state is received (check that iframe gets state updates)

- [ ] **Step 3: Run all tests**

```bash
npx playwright test
```

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: add tournament and expanded game-flow Playwright tests"
```
