import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Undo,
  RotateCcw,
  Check,
  Paintbrush,
  Pen,
  Highlighter,
  Eraser,
  Palette,
} from 'lucide-react';

interface JournalDrawingModalProps {
  isOpen: boolean;
  initialDrawing?: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

type ToolType = 'pen' | 'marker' | 'highlighter' | 'eraser';

const COLOR_PALETTE = [
  '#0f172a', // slate black
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#84cc16', // lime
];

export const JournalDrawingModal: React.FC<JournalDrawingModalProps> = ({
  isOpen,
  initialDrawing,
  onClose,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<ToolType>('marker');
  const [color, setColor] = useState<string>('#3b82f6');
  const [lineWidth, setLineWidth] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [history, setHistory] = useState<ImageData[]>([]);

  // Setup canvas resolution and load initial drawing if any
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Set fixed internal resolution for smooth lines
    const width = 640;
    const height = 440;
    canvas.width = width;
    canvas.height = height;

    // Fill canvas background with clean white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (initialDrawing) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        // Save first state to history
        const initialState = ctx.getImageData(0, 0, width, height);
        setHistory([initialState]);
      };
      img.src = initialDrawing;
    } else {
      const initialState = ctx.getImageData(0, 0, width, height);
      setHistory([initialState]);
    }
  }, [isOpen, initialDrawing]);

  if (!isOpen) return null;

  // Get accurate coordinates inside canvas regardless of CSS scale
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);

    // Configure brush styles
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lineWidth * 3.5;
      ctx.globalAlpha = 1.0;
    } else if (tool === 'highlighter') {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 3;
      ctx.globalAlpha = 0.35;
    } else if (tool === 'pen') {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, lineWidth * 0.7);
      ctx.globalAlpha = 1.0;
    } else {
      // marker
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 1.5;
      ctx.globalAlpha = 0.9;
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.closePath();
    ctx.globalAlpha = 1.0;

    // Push new snapshot to history
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-20), snapshot]);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const newHistory = history.slice(0, -1);
    const prevState = newHistory[newHistory.length - 1];
    ctx.putImageData(prevState, 0, 0);
    setHistory(newHistory);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev, snapshot]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span>Draw and Paint</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-normal bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                Stickers & Doodles
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
              title="Undo last stroke"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Clear Canvas"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="p-4 flex-1 bg-slate-100 dark:bg-slate-950/80 flex items-center justify-center overflow-auto">
          <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-white">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="touch-none cursor-crosshair max-w-full h-auto block"
              style={{ width: '100%', maxWidth: '600px', aspectRatio: '640/440' }}
            />
          </div>
        </div>

        {/* Bottom Toolset Bar (Screenshot 3 style) */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          {/* Color Palette */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Color:
            </span>
            <div className="flex items-center gap-2">
              {COLOR_PALETTE.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => {
                    setColor(c);
                    if (tool === 'eraser') setTool('marker');
                  }}
                  className={`w-7 h-7 rounded-full transition transform shrink-0 ${
                    color === c && tool !== 'eraser'
                      ? 'ring-3 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 scale-110 shadow-xs'
                      : 'hover:scale-105 border border-slate-200/50'
                  }`}
                  style={{ backgroundColor: c }}
                  title={`Color ${c}`}
                />
              ))}

              {/* Custom Color Input */}
              <label
                className="w-7 h-7 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                title="Custom color"
              >
                <Palette className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="color"
                  value={color}
                  onChange={e => {
                    setColor(e.target.value);
                    if (tool === 'eraser') setTool('marker');
                  }}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Tools & Stroke Width */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* Tool Selection Buttons */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  tool === 'pen'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Pen className="w-3.5 h-3.5" />
                <span>Pencil</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('marker')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  tool === 'marker'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>Marker</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('highlighter')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  tool === 'highlighter'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>Highlighter</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  tool === 'eraser'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Eraser</span>
              </button>
            </div>

            {/* Thickness buttons */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Size:
              </span>
              {[2, 5, 9].map(size => (
                <button
                  type="button"
                  key={size}
                  onClick={() => setLineWidth(size)}
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition ${
                    lineWidth === size
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{ width: `${size * 1.5}px`, height: `${size * 1.5}px` }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
