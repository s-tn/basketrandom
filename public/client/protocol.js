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

export function decodePacket(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const type = view.getUint8(0);
  const seq = view.getUint32(1, false);
  const timestamp = view.getUint32(5, false);

  switch (type) {
    case PACKET.SNAPSHOT: {
      const state = {};
      let offset = 9;

      // 17 int16 fields
      for (let i = 0; i < 17; i++) {
        state[FIELD_NAMES[i]] = view.getInt16(offset, false) / DIVISORS[i];
        offset += 2;
      }

      // ballHolder uint8
      state.ballHolder = view.getUint8(offset) / DIVISORS[17];
      offset += 1;

      const score0 = view.getUint8(offset++);
      const score1 = view.getUint8(offset++);
      const flags = view.getUint8(offset++);

      state.score0 = score0;
      state.score1 = score1;
      state.flags = flags;

      return { type, seq, timestamp, state };
    }

    case PACKET.DELTA: {
      let offset = 9;
      const bitmask = view.getUint32(offset, false);
      offset += 4;

      const changes = {};
      for (let i = 0; i < FIELD_NAMES.length; i++) {
        if (bitmask & (1 << i)) {
          if (i < 17) {
            changes[FIELD_NAMES[i]] = view.getInt16(offset, false) / DIVISORS[i];
            offset += 2;
          } else {
            changes[FIELD_NAMES[i]] = view.getUint8(offset) / DIVISORS[i];
            offset += 1;
          }
        }
      }

      return { type, seq, timestamp, bitmask, changes };
    }

    case PACKET.EVENT: {
      const bytes = new Uint8Array(arrayBuffer, 9);
      const text = new TextDecoder('utf-8').decode(bytes);
      const event = JSON.parse(text);
      return { type, seq, timestamp, event };
    }

    case PACKET.PING: {
      return { type, seq, timestamp };
    }

    default:
      return { type, seq, timestamp };
  }
}

export function encodeInput(playerIndex, keyAction, timestamp) {
  const buffer = new ArrayBuffer(11);
  const view = new DataView(buffer);

  view.setUint8(0, PACKET.INPUT);
  view.setUint32(1, 0, false);        // seq = 0
  view.setUint32(5, timestamp, false); // timestamp
  view.setUint8(9, playerIndex);
  view.setUint8(10, keyAction);        // 0 = release, 1 = press

  return buffer;
}
