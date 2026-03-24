export function createDrawer(contentWindow) {
  const doc = contentWindow.document;

  // Create canvas overlay matching game dimensions
  const canvas = doc.createElement('canvas');
  canvas.id = 'draw-overlay';
  canvas.width = 640;
  canvas.height = 360;
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:500;pointer-events:none;';
  doc.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let active = false;
  let drawing = false;
  let lastPos = null;
  let color = '#ffffff';
  let brushSize = 3;

  function enable() {
    active = true;
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'crosshair';
  }

  function disable() {
    active = false;
    canvas.style.pointerEvents = 'none';
    canvas.style.cursor = 'default';
    drawing = false;
    lastPos = null;
  }

  function toggle() {
    if (active) disable(); else enable();
    return active;
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function setColor(c) { color = c; }
  function setBrushSize(s) { brushSize = s; }

  // Draw a line segment (used for both local and remote drawing)
  function drawSegment(x1, y1, x2, y2, c, size) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = c || color;
    ctx.lineWidth = size || brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Collect draw events to send to server
  const pendingSegments = [];

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!active) return;
    drawing = true;
    lastPos = getPos(e);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!active || !drawing) return;
    const pos = getPos(e);
    drawSegment(lastPos.x, lastPos.y, pos.x, pos.y, color, brushSize);
    pendingSegments.push({ x1: lastPos.x, y1: lastPos.y, x2: pos.x, y2: pos.y, c: color, s: brushSize });
    lastPos = pos;
  });

  canvas.addEventListener('mouseup', () => { drawing = false; lastPos = null; });
  canvas.addEventListener('mouseleave', () => { drawing = false; lastPos = null; });

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    if (!active) return;
    e.preventDefault();
    drawing = true;
    lastPos = getPos(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!active || !drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    drawSegment(lastPos.x, lastPos.y, pos.x, pos.y, color, brushSize);
    pendingSegments.push({ x1: lastPos.x, y1: lastPos.y, x2: pos.x, y2: pos.y, c: color, s: brushSize });
    lastPos = pos;
  }, { passive: false });

  canvas.addEventListener('touchend', () => { drawing = false; lastPos = null; });

  // Flush pending segments (call periodically to send to server)
  function flush() {
    if (pendingSegments.length === 0) return null;
    const segments = [...pendingSegments];
    pendingSegments.length = 0;
    return segments;
  }

  // Apply remote segments
  function applyRemote(segments) {
    for (const seg of segments) {
      drawSegment(seg.x1, seg.y1, seg.x2, seg.y2, seg.c, seg.s);
    }
  }

  return { toggle, enable, disable, clear, setColor, setBrushSize, flush, applyRemote, get active() { return active; } };
}
