export const PACKET = {
  SNAPSHOT: 0x01,
  DELTA: 0x02,
  INPUT: 0x03,
  PING: 0x04,
  EVENT: 0x05,
} as const;

export const FIELD_COUNT = 18;
export const HEADER_SIZE = 9; // 1 type + 4 seq + 4 timestamp

export interface GameState {
  p0x: number; p0y: number; p0angle: number;
  p0velX: number; p0velY: number; p0armAngle: number;
  p1x: number; p1y: number; p1angle: number;
  p1velX: number; p1velY: number; p1armAngle: number;
  ballX: number; ballY: number; ballAngle: number;
  ballVelX: number; ballVelY: number;
  ballHolder: number;
  score0: number; score1: number;
  flags: number;
}

export function stateToFields(s: GameState): number[] {
  return [
    Math.round(s.p0x * 100),
    Math.round(s.p0y * 100),
    Math.round(s.p0angle * 1000),
    Math.round(s.p0velX * 100),
    Math.round(s.p0velY * 100),
    Math.round(s.p0armAngle * 1000),
    Math.round(s.p1x * 100),
    Math.round(s.p1y * 100),
    Math.round(s.p1angle * 1000),
    Math.round(s.p1velX * 100),
    Math.round(s.p1velY * 100),
    Math.round(s.p1armAngle * 1000),
    Math.round(s.ballX * 100),
    Math.round(s.ballY * 100),
    Math.round(s.ballAngle * 1000),
    Math.round(s.ballVelX * 100),
    Math.round(s.ballVelY * 100),
    s.ballHolder,
  ];
}

function writeHeader(buf: Buffer, type: number, seq: number): void {
  buf.writeUInt8(type, 0);
  buf.writeUInt32BE(seq, 1);
  buf.writeUInt32BE(Date.now() & 0xffffffff, 5);
}

export function encodeSnapshot(seq: number, state: GameState): Buffer {
  // HEADER_SIZE + 17 int16BE fields (34 bytes) + ballHolder (1) + score0 (1) + score1 (1) + flags (1) = HEADER_SIZE + 38
  const buf = Buffer.allocUnsafe(HEADER_SIZE + 38);
  writeHeader(buf, PACKET.SNAPSHOT, seq);

  const fields = stateToFields(state);
  // Write first 17 fields as int16BE (positions, angles, velocities — all except ballHolder)
  let offset = HEADER_SIZE;
  for (let i = 0; i < 17; i++) {
    buf.writeInt16BE(fields[i], offset);
    offset += 2;
  }
  // ballHolder, score0, score1, flags as uint8
  buf.writeUInt8(state.ballHolder, offset++);
  buf.writeUInt8(state.score0, offset++);
  buf.writeUInt8(state.score1, offset++);
  buf.writeUInt8(state.flags, offset++);

  return buf;
}

export function encodeDelta(seq: number, prev: GameState, curr: GameState): Buffer | null {
  const prevFields = stateToFields(prev);
  const currFields = stateToFields(curr);

  // Also compare score0, score1, flags as extra fields beyond the 18-field stateToFields
  // We treat all 18 "fields" from the spec: 17 continuous + ballHolder from stateToFields,
  // plus score0, score1, flags are additional metadata tracked separately.
  // Per spec, bitmask covers FIELD_COUNT=18 fields. We treat those 18 as stateToFields output.
  // score0, score1, flags are always included when the delta is non-null (as tail bytes).

  let bitmask = 0;
  for (let i = 0; i < FIELD_COUNT; i++) {
    if (prevFields[i] !== currFields[i]) {
      bitmask |= (1 << i);
    }
  }

  // Check if score/flags changed too
  const scoreOrFlagsChanged =
    prev.score0 !== curr.score0 ||
    prev.score1 !== curr.score1 ||
    prev.flags !== curr.flags;

  if (bitmask === 0 && !scoreOrFlagsChanged) {
    return null;
  }

  // Count bytes: each changed field is 2 bytes, except field 17 (ballHolder) which is 1
  let changedBytes = 0;
  for (let i = 0; i < FIELD_COUNT; i++) {
    if (bitmask & (1 << i)) changedBytes += (i === 17) ? 1 : 2;
  }

  // Header + uint32 bitmask + changed field bytes + score0 + score1 + flags (uint8 each)
  const size = HEADER_SIZE + 4 + changedBytes + 3;
  const buf = Buffer.allocUnsafe(size);
  writeHeader(buf, PACKET.DELTA, seq);

  buf.writeUInt32BE(bitmask >>> 0, HEADER_SIZE);

  let offset = HEADER_SIZE + 4;
  for (let i = 0; i < FIELD_COUNT; i++) {
    if (bitmask & (1 << i)) {
      if (i === 17) {
        // ballHolder is uint8, not int16
        buf.writeUInt8(currFields[i], offset);
        offset += 1;
      } else {
        buf.writeInt16BE(currFields[i], offset);
        offset += 2;
      }
    }
  }

  buf.writeUInt8(curr.score0, offset++);
  buf.writeUInt8(curr.score1, offset++);
  buf.writeUInt8(curr.flags, offset++);

  return buf;
}

export function encodeEvent(seq: number, eventType: string, data: Record<string, unknown>): Buffer {
  const payload = Buffer.from(JSON.stringify({ type: eventType, ...data }), 'utf8');
  const buf = Buffer.allocUnsafe(HEADER_SIZE + payload.length);
  writeHeader(buf, PACKET.EVENT, seq);
  payload.copy(buf, HEADER_SIZE);
  return buf;
}

export function encodePing(seq: number): Buffer {
  const buf = Buffer.allocUnsafe(HEADER_SIZE);
  writeHeader(buf, PACKET.PING, seq);
  return buf;
}
