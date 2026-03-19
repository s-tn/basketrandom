export function applyState(window, state) {
  if (!state || !window.players || !window.ball) return;

  // Update score UI
  try {
    const ui = window.c3_runtimeInterface._localRuntime._layoutManager
      ._layoutsByName.get('game')._layersByName.get('ui')._instances;
    ui[2]._sdkInst._SetText(String(state.score1));
    ui[3]._sdkInst._SetText(String(state.score0));
  } catch {}

  // Player 0 bodies
  const p0a = window.players[0]; // body
  const p0b = window.players[1]; // body2
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
  const p1b = window.players[3]; // body4
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
  if (arms[1]) arms[1].angle = state.p0armAngle;
  if (arms[2]) arms[2].angle = state.p1armAngle;
  if (arms[3]) arms[3].angle = state.p1armAngle;

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
