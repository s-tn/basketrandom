export function createClipper(canvas, durationSeconds = 10) {
  let chunks = [];
  let chunkTimestamps = [];
  let recorder = null;
  let duration = durationSeconds;

  try {
    const stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2_000_000,
    });
  } catch (e) {
    try {
      const stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch {
      return { trigger: () => null, setDuration: () => {}, destroy: () => {} };
    }
  }

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
      chunkTimestamps.push(Date.now());
      const cutoff = Date.now() - duration * 1000;
      while (chunkTimestamps.length > 0 && chunkTimestamps[0] < cutoff) {
        chunkTimestamps.shift();
        chunks.shift();
      }
    }
  };

  recorder.start(1000);

  function trigger() {
    if (chunks.length === 0) return null;
    return new Blob([...chunks], { type: 'video/webm' });
  }

  function setDuration(seconds) {
    duration = seconds;
  }

  function destroy() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    chunks = [];
    chunkTimestamps = [];
  }

  return { trigger, setDuration, destroy };
}
