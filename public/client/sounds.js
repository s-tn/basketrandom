let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(frequency, duration, type = 'sine', volume = 0.3) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playGoalSound() {
  // Rising triumphant tone
  playTone(523, 0.15, 'square', 0.2); // C5
  setTimeout(() => playTone(659, 0.15, 'square', 0.2), 100); // E5
  setTimeout(() => playTone(784, 0.3, 'square', 0.25), 200); // G5
}

export function playCountdownBeep() {
  playTone(880, 0.1, 'sine', 0.15); // A5 short beep
}

export function playGoBeep() {
  playTone(1760, 0.3, 'sine', 0.2); // A6 long beep
}

export function playWhistle() {
  playTone(1200, 0.4, 'sawtooth', 0.1);
}

export function playMatchEnd() {
  // Descending fanfare
  playTone(784, 0.2, 'square', 0.2);
  setTimeout(() => playTone(659, 0.2, 'square', 0.2), 200);
  setTimeout(() => playTone(523, 0.4, 'square', 0.25), 400);
}
