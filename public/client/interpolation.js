function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function lerpState(a, b, t) {
  const posVelFields = [
    'p0x', 'p0y', 'p0velX', 'p0velY',
    'p1x', 'p1y', 'p1velX', 'p1velY',
    'ballX', 'ballY', 'ballVelX', 'ballVelY',
  ];

  const angleFields = [
    'p0angle', 'p0armAngle',
    'p1angle', 'p1armAngle',
  ];

  const discreteFields = ['ballHolder', 'score0', 'score1', 'flags'];

  const result = {};

  for (const field of posVelFields) {
    if (field in a && field in b) {
      result[field] = lerp(a[field], b[field], t);
    } else if (field in b) {
      result[field] = b[field];
    } else if (field in a) {
      result[field] = a[field];
    }
  }

  for (const field of angleFields) {
    if (field in a && field in b) {
      result[field] = lerpAngle(a[field], b[field], t);
    } else if (field in b) {
      result[field] = b[field];
    } else if (field in a) {
      result[field] = a[field];
    }
  }

  for (const field of discreteFields) {
    if (field in b) {
      result[field] = b[field];
    } else if (field in a) {
      result[field] = a[field];
    }
  }

  return result;
}

function createStateBuffer(capacity = 10) {
  const buffer = [];

  function push(state, receivedAt = performance.now()) {
    buffer.push({ state, receivedAt });
    if (buffer.length > capacity) {
      buffer.shift();
    }
  }

  function interpolate() {
    if (buffer.length < 2) {
      return buffer.length === 1 ? buffer[buffer.length - 1].state : null;
    }

    const renderTime = performance.now() - 50;

    let beforeIdx = -1;
    let afterIdx = -1;

    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i].receivedAt <= renderTime) {
        beforeIdx = i;
      } else {
        afterIdx = i;
        break;
      }
    }

    if (beforeIdx === -1) {
      return buffer[0].state;
    }
    if (afterIdx === -1) {
      return buffer[buffer.length - 1].state;
    }

    const before = buffer[beforeIdx];
    const after = buffer[afterIdx];
    const span = after.receivedAt - before.receivedAt;
    const t = span === 0 ? 0 : (renderTime - before.receivedAt) / span;

    return lerpState(before.state, after.state, t);
  }

  return {
    push,
    interpolate,
    get latest() {
      return buffer.length > 0 ? buffer[buffer.length - 1].state : null;
    },
    get length() {
      return buffer.length;
    },
  };
}

export { createStateBuffer, lerp, lerpAngle };
