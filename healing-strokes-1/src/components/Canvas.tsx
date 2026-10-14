"use client";
import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Ellipse, Line } from "react-konva";
import type Konva from "konva";
import Modal from "./Modal";
import {
  WIDTH,
  HEIGHT,
  type Mark,
  type Overlay,
  type CanvasState,
} from "@/lib/shared/model";
const tools: [Mark["type"], string, string][] = [
  ["brush", "Brush", "B"],
  ["eraser", "Eraser", "E"],
  ["line", "Line", "L"],
  ["rect", "Rectangle", "R"],
  ["ellipse", "Ellipse", "O"],
];
function Marks({ marks }: { marks: Overlay }) {
  return (
    <>
      {marks.map((m, i) => {
        const [x, y, x2, y2] = m.points,
          common = { stroke: m.color, strokeWidth: m.width, listening: false };
        if (m.type === "rect")
          return (
            <Rect
              key={i}
              {...common}
              x={Math.min(x, x2)}
              y={Math.min(y, y2)}
              width={Math.abs(x2 - x)}
              height={Math.abs(y2 - y)}
            />
          );
        if (m.type === "ellipse")
          return (
            <Ellipse
              key={i}
              {...common}
              x={(x + x2) / 2}
              y={(y + y2) / 2}
              radiusX={Math.abs(x2 - x) / 2}
              radiusY={Math.abs(y2 - y) / 2}
            />
          );
        return (
          <Line
            key={i}
            {...common}
            points={m.points}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation={
              m.type === "eraser" ? "destination-out" : "source-over"
            }
          />
        );
      })}
    </>
  );
}
export default function Canvas({
  snapshot,
  onSave,
  onFinish,
  readOnly = false,
  canWrite = true,
  filename = "healing-strokes",
}: {
  snapshot: CanvasState;
  onSave?: (overlay: Overlay, sequence: number) => Promise<void>;
  onFinish?: (overlay: Overlay, sequence: number) => Promise<void>;
  readOnly?: boolean;
  canWrite?: boolean;
  filename?: string;
}) {
  const stage = useRef<Konva.Stage | null>(null),
    container = useRef<HTMLDivElement | null>(null),
    drawing = useRef(false),
    sequence = useRef(snapshot.sequence),
    dirty = useRef(false),
    saving = useRef(false),
    current = useRef<Overlay>(snapshot.overlay);
  const [marks, setMarks] = useState<Overlay>(snapshot.overlay),
    [redo, setRedo] = useState<Overlay>([]),
    [tool, setTool] = useState<Mark["type"]>("brush"),
    [color, setColor] = useState("#607d69"),
    [width, setWidth] = useState(8),
    [size, setSize] = useState(800),
    [status, setStatus] = useState("Your earlier contributions are locked"),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  function update(next: Overlay) {
    current.current = next;
    setMarks(next);
    dirty.current = true;
  }
  function undo() {
    const m = current.current;
    if (m.length) {
      setRedo((r) => [m[m.length - 1], ...r]);
      update(m.slice(0, -1));
    }
  }
  function redoMark() {
    if (redo.length) {
      update([...current.current, redo[0]]);
      setRedo(redo.slice(1));
    }
  }
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setSize(entries[0].contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (readOnly) return;
    const timer = setInterval(async () => {
      if (!dirty.current || saving.current || !canWrite || !onSaveRef.current)
        return;
      saving.current = true;
      dirty.current = false;
      setStatus("Saving privately…");
      try {
        await onSaveRef.current(current.current, ++sequence.current);
        setStatus("Saved privately · Only you can see this turn");
      } catch (e) {
        dirty.current = true;
        setStatus((e as Error).message);
      } finally {
        saving.current = false;
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [readOnly, canWrite]);
  useEffect(() => {
    if (readOnly) return;
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,select,textarea,button") ||
        !canWrite
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoMark();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoMark();
      } else {
        const selected = tools.find(
          (t) => t[2].toLowerCase() === e.key.toLowerCase(),
        );
        if (selected) setTool(selected[0]);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const point = () => {
    const p = stage.current?.getPointerPosition();
    if (!p) return null;
    return [
      Math.max(0, Math.min(WIDTH, p.x / (size / WIDTH))),
      Math.max(0, Math.min(HEIGHT, p.y / (size / WIDTH))),
    ];
  };
  function down() {
    if (readOnly || !canWrite || busy || confirm) return;
    if (
      current.current.length >= 400 ||
      current.current.reduce((n, o) => n + o.points.length, 0) > 36000
    ) {
      setStatus(
        "This turn is quite detailed. Undo a mark to make room for another.",
      );
      return;
    }
    const p = point();
    if (!p) return;
    drawing.current = true;
    setRedo([]);
    update([
      ...current.current,
      { type: tool, color, width, points: [...p, ...p] },
    ]);
  }
  function move() {
    if (!drawing.current) return;
    const p = point();
    if (!p) return;
    const next = [...current.current],
      last = { ...next[next.length - 1] };
    if (last.type === "brush" || last.type === "eraser") {
      if (last.points.length >= 3998) return;
      const end = last.points.slice(-2);
      if (Math.hypot(end[0] - p[0], end[1] - p[1]) < 2) return;
      last.points = [...last.points, ...p];
    } else last.points = [...last.points.slice(0, 2), ...p];
    next[next.length - 1] = last;
    update(next);
  }
  async function finish() {
    drawing.current = false;
    setBusy(true);
    setStatus("Saving your contribution…");
    try {
      await onFinish?.(current.current, ++sequence.current);
    } catch (e) {
      setStatus((e as Error).message);
      setBusy(false);
    }
  }
  function download() {
    if (!readOnly || !stage.current) return;
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = stage.current.toDataURL({ pixelRatio: WIDTH / size });
    link.click();
  }
  return (
    <section className="canvas-panel panel">
      {!readOnly && (
        <>
          <div className="tools" role="toolbar" aria-label="Drawing tools">
            {tools.map(([t, label, shortcut]) => (
              <button
                key={t}
                className={tool === t ? "tool selected" : "tool"}
                aria-pressed={tool === t}
                title={`${label} (${shortcut})`}
                onClick={() => setTool(t)}
              >
                {label}
              </button>
            ))}
            <label className="color-picker">
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            <label className="brush-width">
              Size{" "}
              <input
                type="range"
                min="1"
                max="64"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
              <span>{width}</span>
            </label>
          </div>
          <div className="canvas-subtools">
            <div className="palette">
              {[
                "#607d69",
                "#98b59a",
                "#c5b7d6",
                "#d5aab6",
                "#e7b68e",
                "#e3ca8e",
                "#7299b0",
                "#3c4850",
                "#ffffff",
              ].map((c) => (
                <button
                  key={c}
                  aria-label={`Use color ${c}`}
                  title={c}
                  style={{ background: c }}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <div>
              <button
                className="text-button"
                onClick={undo}
                disabled={!marks.length || busy}
              >
                ↶ Undo
              </button>
              <button
                className="text-button"
                onClick={redoMark}
                disabled={!redo.length || busy}
              >
                ↷ Redo
              </button>
              <button
                className="text-button"
                onClick={() => setConfirm(true)}
                disabled={!marks.length || busy}
              >
                Clear my turn
              </button>
            </div>
          </div>
        </>
      )}
      <div
        className="artboard"
        ref={container}
        style={{
          cursor: readOnly
            ? "default"
            : tool === "eraser"
              ? "cell"
              : "crosshair",
        }}
      >
        <Stage
          ref={stage}
          width={size}
          height={(size * HEIGHT) / WIDTH}
          scaleX={size / WIDTH}
          scaleY={size / WIDTH}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerLeave={() => {
            drawing.current = false;
          }}
        >
          <Layer listening={false}>
            <Rect width={WIDTH} height={HEIGHT} fill="#fffdf8" />
          </Layer>
          {snapshot.layers.map((layer, i) => (
            <Layer key={i} listening={false}>
              <Marks marks={layer} />
            </Layer>
          ))}
          {!readOnly && (
            <Layer listening={false}>
              <Marks marks={marks} />
            </Layer>
          )}
        </Stage>
      </div>
      {!readOnly ? (
        <>
          <div className="canvas-bottom">
            <span className="small" role="status">
              {canWrite ? status : "Reconnecting… your drawing stays here."}
            </span>
            <button
              className="primary"
              onClick={finish}
              disabled={busy || !canWrite}
            >
              Finish early <span>✓</span>
            </button>
          </div>
          <details className="shortcut-help">
            <summary>Drawing tips & keyboard shortcuts</summary>
            <p>
              Brush B · Eraser E · Line L · Rectangle R · Ellipse O · Undo
              ⌘/Ctrl Z · Redo ⇧⌘/Ctrl Z. The eraser and undo affect your current
              turn only. Your artwork saves privately every 3 seconds; the last
              saved checkpoint is committed when time runs out. Desktop or
              tablet gives you more room, but you can draw with touch on your
              phone too.
            </p>
          </details>
        </>
      ) : (
        <div className="canvas-bottom">
          <span className="small">
            Your shared moment, in 1200 × 800 pixels.
          </span>
          <button className="primary" onClick={download}>
            Download PNG ↓
          </button>
        </div>
      )}
      {confirm && (
        <Modal onClose={() => setConfirm(false)}>
          <div
            className="modal clear-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-label="Clear my turn"
          >
            <p>
              Clear only your marks from this turn? Earlier contributions stay
              safe.
            </p>
            <button className="secondary" onClick={() => setConfirm(false)}>
              Keep drawing
            </button>
            <button
              className="primary"
              onClick={() => {
                update([]);
                setRedo([]);
                setConfirm(false);
              }}
            >
              Clear my turn
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
