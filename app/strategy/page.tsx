"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

const COLORS = ['#ffffff', '#ef4444', '#3b82f6', '#eab308', '#22c55e', '#f97316'];
const COURT_COLOR = '#FF6B35';
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

export default function StrategyPage() {
  const courtCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(4);
  const [eraser, setEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const drawingRef = useRef(false);

  // Draw the court on mount
  useEffect(() => {
    const canvas = courtCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    // === Basket Random side-view game screen ===

    // Sky / background gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#1a1f3a');
    skyGrad.addColorStop(0.6, '#2a2040');
    skyGrad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Ground
    const groundY = h * 0.78;
    ctx.fillStyle = '#2d1f0e';
    ctx.fillRect(0, groundY, w, h - groundY);
    // Ground line
    ctx.strokeStyle = '#4a3520';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    // Ground texture lines
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, groundY);
      ctx.lineTo(i, h);
      ctx.stroke();
    }

    // Center line (dashed)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Left basket/hoop
    const hoopY = groundY * 0.45;
    const hoopSize = 30;
    const backboardH = 60;
    // Backboard
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(30, hoopY - backboardH / 2, 6, backboardH);
    // Hoop ring
    ctx.strokeStyle = COURT_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(36, hoopY);
    ctx.lineTo(36 + hoopSize, hoopY);
    ctx.stroke();
    // Net (simple lines)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= hoopSize; i += 6) {
      ctx.beginPath();
      ctx.moveTo(36 + i, hoopY);
      ctx.lineTo(36 + hoopSize / 2, hoopY + 25);
      ctx.stroke();
    }
    // Pole
    ctx.fillStyle = '#666';
    ctx.fillRect(28, hoopY, 4, groundY - hoopY);

    // Right basket/hoop (mirrored)
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(w - 36, hoopY - backboardH / 2, 6, backboardH);
    ctx.strokeStyle = COURT_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w - 36, hoopY);
    ctx.lineTo(w - 36 - hoopSize, hoopY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= hoopSize; i += 6) {
      ctx.beginPath();
      ctx.moveTo(w - 36 - i, hoopY);
      ctx.lineTo(w - 36 - hoopSize / 2, hoopY + 25);
      ctx.stroke();
    }
    ctx.fillStyle = '#666';
    ctx.fillRect(w - 32, hoopY, 4, groundY - hoopY);

    // Player 1 (left side) — stick figure
    const p1x = w * 0.25;
    const py = groundY;
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    // Body
    ctx.beginPath();
    ctx.moveTo(p1x, py - 50);
    ctx.lineTo(p1x, py - 20);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(p1x, py - 20);
    ctx.lineTo(p1x - 10, py);
    ctx.moveTo(p1x, py - 20);
    ctx.lineTo(p1x + 10, py);
    ctx.stroke();
    // Arms
    ctx.beginPath();
    ctx.moveTo(p1x, py - 40);
    ctx.lineTo(p1x + 15, py - 30);
    ctx.stroke();
    // Head
    ctx.fillStyle = '#4a9eff';
    ctx.beginPath();
    ctx.arc(p1x, py - 58, 8, 0, Math.PI * 2);
    ctx.fill();
    // Label
    ctx.fillStyle = '#4a9eff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P1', p1x, py - 72);

    // Player 2 (right side)
    const p2x = w * 0.75;
    ctx.strokeStyle = '#ff5555';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p2x, py - 50);
    ctx.lineTo(p2x, py - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p2x, py - 20);
    ctx.lineTo(p2x - 10, py);
    ctx.moveTo(p2x, py - 20);
    ctx.lineTo(p2x + 10, py);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p2x, py - 40);
    ctx.lineTo(p2x - 15, py - 30);
    ctx.stroke();
    ctx.fillStyle = '#ff5555';
    ctx.beginPath();
    ctx.arc(p2x, py - 58, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5555';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P2', p2x, py - 72);

    // Ball (center)
    ctx.fillStyle = COURT_COLOR;
    ctx.beginPath();
    ctx.arc(w / 2, groundY - 30, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cc5020';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, groundY - 30, 10, 0, Math.PI * 2);
    ctx.stroke();
    // Ball lines
    ctx.beginPath();
    ctx.moveTo(w / 2 - 10, groundY - 30);
    ctx.lineTo(w / 2 + 10, groundY - 30);
    ctx.stroke();

    // Score area at top
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(w / 2 - 60, 10, 120, 30);
    ctx.fillStyle = '#4a9eff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('0', w / 2 - 8, 31);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('-', w / 2, 31);
    ctx.fillStyle = '#ff5555';
    ctx.textAlign = 'left';
    ctx.fillText('0', w / 2 + 8, 31);

    // Zone labels (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LEFT SIDE', w * 0.25, 20);
    ctx.fillText('RIGHT SIDE', w * 0.75, 20);
  }, []);

  function saveState() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-19), state]);
  }

  function undo() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    setHistory(prev => {
      if (prev.length === 0) return prev;
      if (prev.length === 1) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return [];
      }
      ctx.putImageData(prev[prev.length - 2], 0, 0);
      return prev.slice(0, -1);
    });
  }

  function clearCanvas() {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    saveState();
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  }

  function download() {
    const court = courtCanvasRef.current;
    const draw = drawCanvasRef.current;
    if (!court || !draw) return;
    const merged = document.createElement('canvas');
    merged.width = court.width;
    merged.height = court.height;
    const ctx = merged.getContext('2d')!;
    ctx.drawImage(court, 0, 0);
    ctx.drawImage(draw, 0, 0);
    const link = document.createElement('a');
    link.download = `strategy-${Date.now()}.png`;
    link.href = merged.toDataURL();
    link.click();
  }

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = drawCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    saveState();
    drawingRef.current = true;
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawingRef.current) return;
    const canvas = drawCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = eraser ? '#1a1a2e' : color;
    ctx.lineWidth = eraser ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }

  function stopDraw(e?: React.MouseEvent | React.TouchEvent) {
    e?.preventDefault();
    drawingRef.current = false;
    setDrawing(false);
    lastPos.current = null;
  }

  return (
    <div className="flex flex-col h-screen bg-[#1a1a2e] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-[#FF6B35]/30 shrink-0">
        <h1 className="text-lg font-bold tracking-tight">
          Strategy <span className="text-[#FF6B35]">Board</span>
        </h1>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-[#FF6B35]/20 bg-[#16162a] shrink-0">
        {/* Color swatches */}
        <div className="flex items-center gap-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setEraser(false); }}
              className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c && !eraser ? '#FF6B35' : 'transparent',
                boxShadow: color === c && !eraser ? '0 0 0 1px #FF6B35' : 'none',
              }}
              title={c}
            />
          ))}
          {/* Custom color */}
          <label className="w-6 h-6 rounded-full border-2 border-dashed border-white/40 cursor-pointer flex items-center justify-center hover:border-[#FF6B35] transition-colors overflow-hidden" title="Custom color">
            <input
              type="color"
              className="opacity-0 absolute w-0 h-0"
              value={color}
              onChange={e => { setColor(e.target.value); setEraser(false); }}
            />
            <span className="text-[10px] text-white/60 select-none">+</span>
          </label>
        </div>

        <div className="w-px h-6 bg-white/20" />

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 whitespace-nowrap">Size</span>
          <input
            type="range"
            min={2}
            max={20}
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            className="w-24 accent-[#FF6B35]"
          />
          <span className="text-xs text-white/60 w-4">{brushSize}</span>
        </div>

        <div className="w-px h-6 bg-white/20" />

        {/* Eraser */}
        <Button
          size="sm"
          variant={eraser ? "default" : "outline"}
          className={eraser
            ? "bg-[#FF6B35] text-white border-[#FF6B35] hover:bg-[#e55a24] h-7 px-3 text-xs"
            : "border-white/30 text-white/70 hover:border-[#FF6B35] hover:text-[#FF6B35] h-7 px-3 text-xs"}
          onClick={() => setEraser(e => !e)}
        >
          Eraser
        </Button>

        {/* Undo */}
        <Button
          size="sm"
          variant="outline"
          className="border-white/30 text-white/70 hover:border-[#FF6B35] hover:text-[#FF6B35] h-7 px-3 text-xs"
          onClick={undo}
          disabled={history.length === 0}
        >
          Undo
        </Button>

        {/* Clear */}
        <Button
          size="sm"
          variant="outline"
          className="border-white/30 text-white/70 hover:border-red-500 hover:text-red-400 h-7 px-3 text-xs"
          onClick={clearCanvas}
        >
          Clear
        </Button>

        {/* Download */}
        <Button
          size="sm"
          variant="outline"
          className="border-[#FF6B35]/50 text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white h-7 px-3 text-xs ml-auto"
          onClick={download}
        >
          Download PNG
        </Button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <div
          className="relative w-full"
          style={{ maxWidth: '900px', aspectRatio: '900 / 500' }}
        >
          {/* Court canvas (static background) */}
          <canvas
            ref={courtCanvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="absolute inset-0 w-full h-full rounded-lg"
          />
          {/* Drawing canvas (user input layer) */}
          <canvas
            ref={drawCanvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="absolute inset-0 w-full h-full rounded-lg"
            style={{ cursor: eraser ? 'cell' : 'crosshair' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        </div>
      </div>
    </div>
  );
}
