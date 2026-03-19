# Basket Random — Completion Design Spec

## Overview

Finish Basket Random as a full-featured real-time multiplayer basketball game platform with tournament system, Discord integration, and Twitch streaming. The core constraint: the game engine is Construct 3 running in a server-side headless browser (Puppeteer), and we inject custom code into the compiled C3 runtime.

## Architecture

```
┌─────────────────────────────────┐
│  Client (Browser)               │
│  Next.js React UI               │
│  Game iframe (C3 embed)         │
│  Interpolation buffer           │
│  Server state applied to C3     │
└──────────┬──────────────────────┘
           │ WebSocket (binary, delta-compressed)
┌──────────▼──────────────────────┐
│  Game Server (API Routes)       │
│  Puppeteer orchestration        │
│  Authoritative game state       │
│  Input processing pipeline      │
│  Tournament engine              │
│  Disconnect/reconnect handler   │
└──────────┬──────────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌─────────┐  ┌──────────┐
│ SQLite  │  │ Discord  │
│ Prisma  │  │ Bot      │
└─────────┘  └──────────┘
```

### Client-Server Rendering Model

The client runs a C3 engine instance purely for **rendering**. The server-side Puppeteer C3 instance is the **authority**. The client does NOT run its own physics simulation — it receives authoritative positions from the server and applies them to its local C3 objects for display. This avoids dual-simulation conflicts.

### Puppeteer Instance Management

All game rooms share a **single Chromium process** (`browserPromise` singleton). Each room gets its own `page`. Constraints:
- Max concurrent rooms: ~10-15 pages per Chromium instance (monitor memory)
- Page crash isolation: if a page crashes, only that room is affected — other pages survive
- On server restart: all in-flight games are lost (no state persistence for mid-game — acceptable for MVP)

---

## Phase 1: Fix the Foundation

### 1.1 Critical Bug Fixes

- **`room-detail.tsx` line ~110**: `push("/rooms")` references undefined function. Fix to `router.push("/rooms")`.
- **`headless/[id]/route.ts`**: `headless: false` → `headless: "new"` for production. Add env-based toggle: `HEADLESS=true` in production, `false` for local debugging.
- **`schema.prisma`**: Fix `oppponent` → `opponent`. Since SQLite data is ephemeral (dev.db), delete and recreate with `prisma db push --force-reset`.
- **`types.ts`**: Align `Room` interface with Prisma schema (currently diverged — interface has `createdBy`/`players`/`maxScore`/`bestOf`, schema has `host`/`opponent`/`scoreMax`/`roundGoal`).

### 1.2 Code Cleanup

- Remove all `console.log` debug statements from production code paths. Replace critical ones with a simple `log()` wrapper that checks `NODE_ENV`.
- Remove dead code: `cancer()` function in `offline-game.tsx`.
- Remove Discord bot stub from `headless/[id]/route.ts` — Discord will get its own module in Phase 4.
- Remove unused imports and `any` type casts where possible.
- Remove the duplicate `compress()`/`decompress()` from `headless/[id]/route.ts` — currently duplicated between server and `public/client/compression.js`. Both will be replaced in Phase 2.
- Decide on the `Socket` Prisma model: the code maintains in-memory `sockets` arrays instead of using it. Either remove the model or migrate to using it. **Recommendation: remove it** — in-memory tracking is correct for ephemeral WebSocket state.

### 1.3 Memory Leak Fixes

- **`room-detail.tsx`**: All `setInterval` calls need corresponding `clearInterval` in cleanup (React `useEffect` return). All `addEventListener` calls need `removeEventListener`.
- **`window.onbeforeunload`**: Use `addEventListener`/`removeEventListener` pattern instead of direct assignment.

### 1.4 Disconnect / Reconnect Handling

Currently missing entirely. Add:
- **Server-side**: On WebSocket `close` event, remove client from `sockets`/`gamers` arrays. If a player disconnects mid-game:
  - Pause the game (30 second reconnect window)
  - If reconnect within window: resume, resync full state snapshot
  - If timeout: forfeit the round to the remaining player
- **Client-side**: Use `reconnecting-websocket` (already a dependency) with exponential backoff. On reconnect, request full state snapshot from server.
- **Cleanup**: When both players disconnect or game ends, close the Puppeteer page and remove room resources.

### 1.5 Gitignore & Environment

- Run `git rm -r --cached data/` to remove Chrome profile artifacts from git history, then add `data/` to `.gitignore`.
- Create `.env.example` with:
  ```
  DATABASE_URL="file:./dev.db"
  HEADLESS=true
  DISCORD_TOKEN=
  DISCORD_CHANNEL_ID=
  DISCORD_VOICE_CHANNEL_ID=
  TWITCH_STREAM_KEY=
  NODE_ENV=development
  PORT=9000
  ```

---

## Phase 2: Multiplayer Netcode Revamp

This is the most critical phase. The current approach sends full game state at ~96 FPS with basic velocity extrapolation. This causes jitter, desync, and input delay.

### 2.1 Data Channel: Replace console.log with page.exposeFunction

**Current flow (broken for binary):**
```
C3 page setInterval → console.log(base64 JSON) → page.on('console') → parse → compress → WS text frame
```

The `console.log` channel only supports strings. To send binary/structured data efficiently:

**New flow:**
```
Server injects extraction function once → server calls page.evaluate(() => window.__extractState()) per tick → returns flat array → server diffs & packs binary → WS binary frame
```

Alternatively, use `page.exposeFunction('__sendState', callback)` so the C3 page can push state to Node.js directly without `evaluate()` round-trips:
```
Server calls page.exposeFunction('__sendState', (flatState) => { ... })
Server injects setInterval in page that calls window.__sendState(extractedState)
```

This eliminates the `page.evaluate()` overhead per tick. The `__sendState` callback receives a JSON-serializable array (not binary — Puppeteer serializes across the CDP boundary). Binary packing happens server-side after receiving the flat array.

### 2.2 Protocol: Binary Delta Compression

**Binary packet format:**
```
[1 byte: packet type] [4 bytes: sequence number] [4 bytes: server timestamp ms] [payload]
```

Packet types:
- `0x01` — Full state snapshot (sent on connect, on reconnect, every 5 seconds as baseline)
- `0x02` — Delta update (only changed fields since last acked snapshot)
- `0x03` — Player input (client → server)
- `0x04` — Ping/pong
- `0x05` — Game event (score, round end, coin flip, etc.)

**Snapshot payload layout (0x01):**
Fixed-size, fixed-order. All positions as int16 (value * 100). All angles as int16 (radians * 1000).
```
[2 bytes: p0.x] [2 bytes: p0.y] [2 bytes: p0.angle]
[2 bytes: p0.velX] [2 bytes: p0.velY]
[2 bytes: p0.armAngle]
[2 bytes: p1.x] [2 bytes: p1.y] [2 bytes: p1.angle]
[2 bytes: p1.velX] [2 bytes: p1.velY]
[2 bytes: p1.armAngle]
[2 bytes: ball.x] [2 bytes: ball.y] [2 bytes: ball.angle]
[2 bytes: ball.velX] [2 bytes: ball.velY]
[1 byte: ball.holder] (0=none, 1=p0, 2=p1)
[1 byte: score0] [1 byte: score1]
[1 byte: flags] (bits: gameRunning, p0Up, p1Up)
```
Total snapshot payload: ~39 bytes (vs ~2KB current).

**Delta payload (0x02):**
```
[2 bytes: bitmask of changed fields] [values for changed fields only, in order]
```
Each bit in the bitmask corresponds to a field in the snapshot layout. Only fields with set bits are included. Typical delta: ~10-20 bytes.

**Input payload (0x03, client → server):**
```
[1 byte: player index] [1 byte: key action] [4 bytes: client timestamp]
```
Key action: 0=release, 1=press. Only 'up'/'w' keys matter.

### 2.3 Client-Side Interpolation (Replaces Current Extrapolation)

The current `tick.js` uses velocity-based **extrapolation** (`savedX += velocity[0] / 60`). This diverges quickly and causes jitter when corrections arrive. **Replace entirely** with an interpolation buffer approach.

**Interpolation buffer (fixes jitter):**
- Buffer incoming server states in a ring buffer (capacity: 10 frames)
- Render at a fixed delay behind real-time: `INTERPOLATION_DELAY = 50ms` (fixed, not adaptive — simplicity over marginal gain)
- On each render frame, find the two buffered states surrounding `now - INTERPOLATION_DELAY` and lerp between them
- This smooths out network jitter at the cost of 50ms visual delay (imperceptible for this game type)

**No client-side prediction.** The client C3 engine is display-only. Server is authoritative. Inputs are sent to server and take effect when the next server state arrives. With 50ms interpolation delay + ~20-50ms RTT, total input latency is ~70-100ms — acceptable for a casual basketball game.

**Implementation replaces `tick.js` entirely:**
```js
const INTERP_DELAY = 50; // ms
const stateBuffer = []; // { state, serverTime, receivedAt }

function onServerState(packet) {
    stateBuffer.push({
        state: decodeSnapshot(packet),
        serverTime: packet.timestamp,
        receivedAt: performance.now()
    });
    // Keep last 10 states
    if (stateBuffer.length > 10) stateBuffer.shift();
}

function renderTick() {
    const renderTime = performance.now() - INTERP_DELAY;
    const [a, b] = findBracketingStates(stateBuffer, renderTime);
    if (!a || !b) return; // not enough data yet

    const t = clamp((renderTime - a.receivedAt) / (b.receivedAt - a.receivedAt), 0, 1);

    // Apply interpolated state to C3 objects
    applyToC3(window.player0, lerp2D(a.state.p0, b.state.p0, t));
    applyToC3(window.player1, lerp2D(a.state.p1, b.state.p1, t));
    applyToC3(window.ball, lerp2D(a.state.ball, b.state.ball, t));

    // Scores: no interpolation, just use latest
    updateScoreUI(b.state.score0, b.state.score1);

    requestAnimationFrame(renderTick);
}
```

### 2.4 Server Tick Optimization

**Current:** `setInterval(tick, 1000/96)` with `page.evaluate()` per tick + `console.log` data channel.

**Improved:**
- Use `page.exposeFunction` for data channel (see 2.1) — eliminates per-tick `evaluate()` overhead
- State extraction runs as a `setInterval` inside the C3 page at **60 Hz** (matching C3's typical tick rate). Verify actual C3 tick rate by checking `c3_runtimeInterface._localRuntime._iRuntime.GetTickRate()` or timing frames.
- Score detection: keep the existing `AudioDOMHandler._Play()` hook (it's reliable — fires immediately on goal). Do NOT poll for scores on a timer. The audio hook fires a `0x05` game event packet immediately.
- Input processing: immediate on WebSocket receive, no batching needed (game only has 2 inputs: up/w press and release)

### 2.5 Connection Quality Indicator

Simple implementation (defer adaptive behavior):
- Track RTT per client via ping/pong every 1 second
- Display indicator in client UI: green (<80ms), yellow (80-150ms), red (>150ms)
- No adaptive buffer sizing for now — fixed 50ms interpolation delay is sufficient

### 2.6 Testing with Playwright

Use Playwright to validate the netcode:
- Launch two browser contexts connecting to the same room
- Simulate inputs on both sides (keyboard press/release)
- Measure: time from input to visual update, state consistency between clients
- Assert: positions match within tolerance after N frames, scores always agree
- Test reconnection: kill one client's WebSocket, verify game pauses, reconnect, verify resume

---

## Phase 3: Tournament System

### 3.1 Data Model

New Prisma models:

```prisma
model Tournament {
  id          String   @id @default(cuid())
  name        String
  format      String   // "bracket" | "round_robin"
  status      String   @default("registration") // "registration" | "in_progress" | "completed"
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
  roomId       String?    @unique // links to Room when match is live
  round        Int
  matchIndex   Int        // position within the round
  player0Id    String?    // FK to TournamentParticipant (null = TBD/bye)
  player1Id    String?    // FK to TournamentParticipant
  winnerId     String?    // FK to TournamentParticipant
  status       String     @default("pending") // "pending" | "live" | "completed"

  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  room         Room?      @relation(fields: [roomId], references: [id])
  player0      TournamentParticipant? @relation("MatchPlayer0", fields: [player0Id], references: [id])
  player1      TournamentParticipant? @relation("MatchPlayer1", fields: [player1Id], references: [id])
  winner       TournamentParticipant? @relation("MatchWinner", fields: [winnerId], references: [id])
}
```

Updated `Room` model:
```prisma
model Room {
  id        String   @id
  host      String
  createdAt DateTime @default(now())
  name      String
  opponent  String?                    // fixed typo
  roundGoal Int      @default(3)
  rounds    String   @default("[]")
  wins0     Int      @default(0)
  wins1     Int      @default(0)
  started   Boolean  @default(false)
  scoreMax  Int      @default(10)
  tournament Boolean @default(false)
  private   Boolean  @default(false)   // new: hide from public room list
  score0    Int      @default(0)
  score1    Int      @default(0)
  winner    Int?

  tournamentMatch TournamentMatch?     // back-relation
}
```

Remove the `Socket` model (unused — WebSocket state tracked in-memory).

### 3.2 Tournament Engine

Server-side logic in `app/lib/tournament.ts`:

**Bracket generation (single elimination):**
- Seed players (random or manual)
- Handle byes for non-power-of-2 player counts (highest seeds get byes in round 1)
- Generate all match slots for each round: round 1 has `ceil(n/2)` matches, subsequent rounds halve
- On match completion → advance winner to next round's match slot

**Round-robin generation:**
- Generate all pairings using the circle method: `n*(n-1)/2` total matches
- For odd player counts, add a "bye" phantom player — one real player sits out each round
- Schedule in rounds so each player plays once per round
- Track standings: wins, losses, point differential (total score0 - score1 across matches)

**Match lifecycle:**
1. Tournament engine creates `TournamentMatch` records with `status: "pending"` when tournament starts
2. When a match becomes "ready" (both participants assigned, previous round complete), tournament engine calls `prisma.room.create()` with tournament flag and private flag, links room to match
3. Both participants navigate to the room (UI shows "Your match is ready — Join" button on tournament page)
4. Room plays via the standard headless game flow — no special tournament logic needed in the game server
5. On room completion (winner set), the headless route fires a tournament advancement webhook/function:
   - `updateTournamentMatch(roomId, winnerId)` → sets match status to "completed", sets winnerId
   - For brackets: assigns winner to next round's match (player0 or player1 slot based on matchIndex)
   - For round-robin: updates participant wins/losses/standings
6. When all matches in a tournament are complete → set tournament status to "completed"

**Player identity:** Since there's no auth system, tournament participants are matched to room players by name. The room's `host`/`opponent` fields must match the participant's `playerName`. The tournament join flow sets the player's name in localStorage, and room creation/joining uses that name. Not tamper-proof, but sufficient without auth.

### 3.3 Tournament UI

**New pages:**
- `/tournaments` — list active/upcoming tournaments
- `/tournaments/create` — create tournament (name, format, max players, streamed toggle)
- `/tournaments/[id]` — tournament detail page with:
  - Bracket view (for elimination): tree layout, rounds as columns, matches as nodes
  - Standings table (for round-robin): sortable by wins, point differential
  - Participant list with join/leave buttons
  - Live indicators for in-progress matches
  - "Join Match" button when a player's match is ready

### 3.4 Streamed Tournament Mode

When `tournament.streamed === true`:
- Rooms created for tournament matches have `private: true` (hidden from public room list)
- Puppeteer stream is activated for each match (existing `puppeteer-stream` dep — partially wired up already in headless route, needs to be made reliable)
- Stream output → Twitch via RTMP (existing `twitch-stream-video` dep)
- Stream output → Discord voice channel (Phase 4) — audio only, demux Opus from WebM stream
- Tournament UI shows live indicator + Twitch link for streamed matches

### 3.5 Spectator Protocol

For streamed matches, spectators watch via Twitch/Discord (not in-browser). No in-browser spectator WebSocket needed for MVP. The tournament UI shows:
- Match status (live/completed)
- Link to Twitch stream if streamed
- Live score updates via polling tournament API (every 5s)

---

## Phase 4: Discord Integration

### 4.1 Bot Setup

New module: `app/lib/discord.ts`

- Single Discord.js client instance (singleton, like Prisma client)
- Initialize in `server.js` on startup (NOT in a lazy-loaded API route — the bot needs to be online always)
- `server.js` imports `app/lib/discord.ts` and calls `discordClient.login(process.env.DISCORD_TOKEN)` after server starts
- Register slash commands on `ready` event
- Gracefully skip if `DISCORD_TOKEN` is not set (optional integration)

### 4.2 Notification Bot

**Events → Discord messages (embed format):**

| Event | Discord Message |
|-------|----------------|
| Room created (non-private) | "{host} created room {name}" |
| Match started | "{p0} vs {p1} — Match started!" |
| Match ended | "{winner} wins! Final: {score}" |
| Tournament created | "Tournament {name} open for registration ({format}, {maxPlayers} slots)" |
| Tournament match result | "{winner} advances! ({score})" |
| Tournament winner | "{winner} wins tournament {name}!" |

**Implementation:** Export a `notify(event, data)` function from `discord.ts`. Call it from the relevant API routes / tournament engine. Posts to `DISCORD_CHANNEL_ID`.

### 4.3 Voice Channel Streaming

For streamed tournament matches:
- Bot joins voice channel (`DISCORD_VOICE_CHANNEL_ID`)
- Pipeline: `puppeteer-stream` → WebM stream → demux audio (Opus) → `@discordjs/voice` `AudioResource` → voice channel
- Demuxing: use `prism-media` (bundled with discord.js) to extract Opus packets from WebM container
- Bot leaves channel when match ends
- Video: users watch on Twitch. Discord gets audio only with a text message linking to the Twitch stream.

---

## Phase 5: Polish & Deploy Prep

### 5.1 Error Handling

- Add React error boundaries around game container and room components
- Proper error states in UI (room not found, connection lost, game crashed)
- Server-side: replace silent try-catch swallows with logged errors + client notification via `0x05` event packet
- WebSocket reconnection: use `reconnecting-websocket` (already a dependency) with exponential backoff

### 5.2 UI Polish

- Loading skeletons for room list, tournament bracket
- Connection quality indicator (green/yellow/red dot based on RTT)
- Proper countdown animation before match starts
- Coin flip animation (visual ceremony before each round)
- Responsive layout for mobile spectating

### 5.3 Environment & Config

- `.env.example` with all required vars documented
- `next.config.mjs` environment validation on startup (fail fast if required vars missing)
- SQLite WAL mode for Litestream compatibility: add `PRAGMA journal_mode=WAL` on Prisma connection

### 5.4 Deployment (Fly.io)

- `Dockerfile` for production build (Node.js + Chromium)
- `fly.toml` configuration
- Litestream for SQLite replication/backup (dep already in package.json)
- Health check endpoint (`/api/ping` already exists)
- Persistent volume for SQLite + Puppeteer cache

---

## Testing Strategy

### Playwright Integration Tests

Since we're injecting into compiled C3 code, Playwright is the primary testing tool:

1. **Netcode tests:**
   - Two browser contexts, same room
   - Measure input-to-render latency
   - Assert state consistency (positions within tolerance)
   - Test reconnection: kill one client's WebSocket, verify game pauses, reconnect, verify resume

2. **Game flow tests:**
   - Create room → join → play → score → round end → match end
   - Verify database state after match (winner, rounds, scores)
   - Test room deletion and cleanup

3. **Tournament tests:**
   - Create tournament → register players → start → verify bracket generated
   - Complete a match → verify bracket advancement
   - Test with byes (non-power-of-2 player counts)
   - Full tournament playthrough (4 players, single elimination)

4. **Room tests:**
   - CRUD operations via API
   - Room list filtering (hide private rooms)
   - Lobby WebSocket communication

### Test file structure:
```
tests/
  netcode.spec.ts      — latency, sync, jitter tests
  game-flow.spec.ts    — end-to-end game lifecycle
  tournament.spec.ts   — tournament creation and progression
  rooms.spec.ts        — room CRUD and lobby
```

---

## Key Technical Decisions

1. **Keep SQLite** — Sufficient for single-server deployment on Fly.io. Litestream handles backup/replication. WAL mode required.

2. **Keep Puppeteer as game host** — The C3 engine runs in a browser. No rewrite. Optimize the bridge (`page.exposeFunction` instead of `console.log`, binary protocol, delta compression).

3. **`page.exposeFunction` over `console.log`** — The current `console.log` channel only supports strings and adds serialization overhead. `exposeFunction` lets the C3 page push structured data to Node.js directly.

4. **Client C3 is display-only** — No client-side physics prediction. Server is fully authoritative. Client receives positions and applies them. Interpolation buffer handles smoothing. This avoids dual-simulation conflicts.

5. **Fixed interpolation delay over adaptive** — 50ms fixed delay is simple and sufficient. Adaptive buffer sizing is premature optimization for a casual game with few concurrent players.

6. **Binary WebSocket frames** — Fixed-layout binary snapshots (~39 bytes) vs current text compression (~2KB). Delta encoding reduces typical updates to ~10-20 bytes.

7. **Tournament participants linked by FK, not name strings** — Referential integrity between matches and participants via proper Prisma relations.

8. **Spectators via Twitch/Discord, not in-browser** — Avoids building a spectator WebSocket protocol. Tournament UI shows scores via API polling.

9. **Discord audio-only streaming** — Demux Opus from WebM (puppeteer-stream output). Video via Twitch link. Avoids Discord screen-share complexity.

---

## File Map (New & Modified)

### New Files
```
app/lib/discord.ts              — Discord bot singleton + notify()
app/lib/tournament.ts           — Tournament engine (bracket/round-robin)
app/lib/netcode.ts              — Binary protocol encode/decode (server-side)
app/api/tournaments/route.ts    — Tournament list + create
app/api/tournaments/[id]/route.ts — Tournament detail, update, start
app/tournaments/page.tsx        — Tournament list page
app/tournaments/create/page.tsx — Create tournament page
app/tournaments/[id]/page.tsx   — Tournament detail/bracket page
public/client/interpolation.js  — Interpolation buffer + lerp utilities
public/client/protocol.js       — Binary packet decode (client-side)
tests/netcode.spec.ts           — Playwright netcode tests
tests/game-flow.spec.ts         — Playwright game flow tests
tests/tournament.spec.ts        — Playwright tournament tests
tests/rooms.spec.ts             — Playwright room tests
.env.example                    — Environment template
```

### Modified Files
```
prisma/schema.prisma            — Fix typo, remove Socket model, add Tournament models, add Room.private + back-relation
app/lib/types.ts                — Align interfaces with schema, add tournament types
app/lib/rooms.ts                — Clean up localStorage/API hybrid
app/api/headless/[id]/route.ts  — Replace data channel (exposeFunction), binary protocol, disconnect handling, cleanup
app/components/game-container.tsx — New interpolation-based rendering, cleanup
app/components/room-detail.tsx  — Bug fixes, memory leak fixes, cleanup
app/components/room-list.tsx    — Filter private rooms, add tournament indicator
app/components/offline-game.tsx — Remove dead code
app/components/create-room-form.tsx — Tournament options
public/client/main.js           — Binary protocol integration, new tick setup
public/client/tick.js           — Replace with interpolation buffer (full rewrite)
public/client/compression.js    — Delete (replaced by binary protocol)
server.js                       — Discord bot init, env validation
.gitignore                      — Add data/
package.json                    — Add playwright, @playwright/test
```
