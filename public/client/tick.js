export function applyState(window, state) {
  if (!state || !window.players || !window.ball) return;

  // Update score UI
  try {
    const ui = window.c3_runtimeInterface._localRuntime._layoutManager
      ._layoutsByName.get('game')._layersByName.get('ui')._instances;
    ui[2]._sdkInst._SetText(String(state.score1));
    ui[3]._sdkInst._SetText(String(state.score0));
  } catch {}

  // flags bit0 = 2v2. In 1v1 the second character of each team (body2/head2/arm2,
  // body4/head4/arm4) is unused — park it far off-map so it can't touch the game.
  const is2v2 = ((state.flags ?? 0) & 1) === 1;

  if (!is2v2) {
    const park = (body, head, arm, x) => {
      for (const obj of [body, head, arm]) {
        if (!obj) continue;
        obj.x = x;
        obj.y = -4000;
        try { obj.behaviors.Physics.angularVelocity = 0; } catch {}
      }
    };
    park(window.players[1], window.heads[1], window.arms[1], -4000);
    park(window.players[3], window.heads[3], window.arms[3], -6000);
  }

  // Player 0 bodies
  const p0a = window.players[0]; // body
  const p0b = is2v2 ? window.players[1] : null; // body2 (2v2 only)
  if (p0a) {
    p0a.x = state.p0x;
    p0a.y = state.p0y;
    p0a.angle = state.p0angle;
    try { p0a.behaviors.Physics.angularVelocity = 0; } catch {}
  }
  if (p0b) {
    p0b.x = state.p0x;
    p0b.y = state.p0y;
    try { p0b.behaviors.Physics.angularVelocity = 0; } catch {}
  }

  // Player 1 bodies
  const p1a = window.players[2]; // body3
  const p1b = is2v2 ? window.players[3] : null; // body4 (2v2 only)
  if (p1a) {
    p1a.x = state.p1x;
    p1a.y = state.p1y;
    p1a.angle = state.p1angle;
    try { p1a.behaviors.Physics.angularVelocity = 0; } catch {}
  }
  if (p1b) {
    p1b.x = state.p1x;
    p1b.y = state.p1y;
    try { p1b.behaviors.Physics.angularVelocity = 0; } catch {}
  }

  // Arms
  const arms = window.arms;
  if (arms[0]) arms[0].angle = state.p0armAngle;
  if (is2v2 && arms[1]) arms[1].angle = state.p0armAngle;
  if (arms[2]) arms[2].angle = state.p1armAngle;
  if (is2v2 && arms[3]) arms[3].angle = state.p1armAngle;

  // Ball
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
