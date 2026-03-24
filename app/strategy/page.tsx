"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

const COLORS = ['#ffffff', '#ef4444', '#3b82f6', '#eab308', '#22c55e', '#f97316'];
const COURT_COLOR = '#FF6B35';
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;

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

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = COURT_COLOR;
    ctx.lineWidth = 3;
    const margin = 40;

    // Court outline
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

    // Center line
    ctx.beginPath();
    ctx.moveTo(w / 2, margin);
    ctx.lineTo(w / 2, h - margin);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Left basket area
    ctx.strokeRect(margin, h / 2 - 80, 80, 160);
    ctx.beginPath();
    ctx.arc(margin + 80, h / 2, 40, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Right basket area
    ctx.strokeRect(w - margin - 80, h / 2 - 80, 80, 160);
    ctx.beginPath();
    ctx.arc(w - margin - 80, h / 2, 40, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();

    // Hoop indicators
    ctx.fillStyle = COURT_COLOR;
    ctx.fillRect(margin, h / 2 - 5, 10, 10);
    ctx.fillRect(w - margin - 10, h / 2 - 5, 10, 10);
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#FF6B35]/30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (window.location.href = '/')}
            className="text-[#FF6B35] hover:text-[#ff8c5a] transition-colors text-sm font-medium"
          >
            &larr; Back
          </button>
          <h1 className="text-lg font-bold tracking-tight">
            Strategy <span className="text-[#FF6B35]">Board</span>
          </h1>
        </div>
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
