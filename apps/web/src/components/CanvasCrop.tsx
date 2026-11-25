import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LabelImageCrop, LabelImageElement } from "@tls/core";
import { cropFromPixels, cropToPixels, drawCrop, FULL_CROP, moveCrop, normalizeCrop, resizeCrop,
  type CropHandle, type CropPoint, type CropRect } from "../lib/imageCrop";
import { findQrCode } from "../lib/qrCrop";

const HANDLES: Array<{ id: CropHandle; name: string; x: number; y: number }> = [
  { id: "nw", name: "top left", x: 0, y: 0 }, { id: "n", name: "top", x: .5, y: 0 },
  { id: "ne", name: "top right", x: 1, y: 0 }, { id: "e", name: "right", x: 1, y: .5 },
  { id: "se", name: "bottom right", x: 1, y: 1 }, { id: "s", name: "bottom", x: .5, y: 1 },
  { id: "sw", name: "bottom left", x: 0, y: 1 }, { id: "w", name: "left", x: 0, y: .5 },
];
type Gesture = { pointerId: number; start: CropPoint; original: CropRect; mode: "draw" | "move" | CropHandle };
type Rotation = NonNullable<LabelImageElement["rotation"]>;
interface Props {
  image: LabelImageElement;
  /** The label canvas. The original image and crop box are drawn on it. */
  paper: HTMLElement;
  onCancel: () => void;
  onApply: (crop: LabelImageCrop | null, rotation: Rotation) => void;
}

/**
 * Crop directly on the label canvas: the canvas shows the whole original
 * image with the kept area outlined, and the bottom bar holds the crop tools.
 */
export function CanvasCrop({ image, paper, onCancel, onApply }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [crop, setCrop] = useState(() => cropFromPixels(image.crop));
  const [drawing, setDrawing] = useState(!image.crop);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState("");
  const [rotation, setRotation] = useState<Rotation>(image.rotation ?? 0);
  const [qrState, setQrState] = useState<{ busy: boolean; message: string }>({ busy: false, message: "" });

  const originalCrop = cropFromPixels(image.crop);
  const unchanged = image.crop && size?.width === image.crop.sourceWidth && size.height === image.crop.sourceHeight
    && Object.keys(crop).every(key => crop[key as keyof CropRect] === originalCrop[key as keyof CropRect]);
  const pixels = unchanged ? image.crop! : size ? cropToPixels(crop, size.width, size.height) : null;
  const apply = () => {
    if (pixels && !error) onApply(crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1 ? null : pixels, rotation);
  };
  const latest = useRef({ apply, onCancel });
  latest.current = { apply, onCancel };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); latest.current.onCancel(); }
      else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement
        || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement)?.tagName === "SUMMARY")) {
        event.preventDefault(); latest.current.apply();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const findQr = async () => {
    setQrState({ busy: true, message: "Looking for a QR code…" });
    try {
      const found = await findQrCode(image.source);
      if (!found) {
        setQrState({ busy: false, message: "No QR code found. Drag a box around it instead." });
        return;
      }
      setCrop(found.crop);
      setDrawing(false);
      const sample = found.data.length > 48 ? `${found.data.slice(0, 48)}…` : found.data;
      setQrState({ busy: false, message: `Found a QR code${sample ? ` (reads “${sample}”)` : ""}. The box keeps the white border scanners need.` });
    } catch {
      setQrState({ busy: false, message: "This image could not be checked for a QR code." });
    }
  };

  const point = (event: React.PointerEvent): CropPoint => {
    const rect = surface.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  const nextCrop = (active: Gesture, end: CropPoint) => active.mode === "draw" ? drawCrop(active.start, end)
    : active.mode === "move" ? moveCrop(active.original, { x: end.x - active.start.x, y: end.y - active.start.y })
    : resizeCrop(active.original, active.mode, end);
  const startGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.button !== 0 || !size || gesture.current) return;
    event.preventDefault();
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-crop-handle]")?.dataset.cropHandle as CropHandle | undefined;
    const inside = Boolean(target.closest(".crop-selection"));
    const start = point(event);
    gesture.current = { pointerId: event.pointerId, start, original: crop,
      mode: handle ?? (!drawing && inside ? "move" : "draw") };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updateGesture = (event: React.PointerEvent<HTMLDivElement>, finish = false) => {
    event.stopPropagation();
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const end = point(event);
    // Taps do not accidentally replace a useful selection with a tiny rectangle.
    const moved = Math.abs(end.x - active.start.x) + Math.abs(end.y - active.start.y) >= .01;
    setCrop(active.mode === "draw" && !moved ? active.original : nextCrop(active, end));
    if (finish) {
      gesture.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (moved) setDrawing(false);
    }
  };
  const cancelGesture = () => {
    if (gesture.current) setCrop(gesture.current.original);
    gesture.current = null;
  };
  const adjustWithKeyboard = (event: React.KeyboardEvent, handle?: CropHandle) => {
    const directions: Record<string, CropPoint> = { ArrowLeft: { x: -.005, y: 0 }, ArrowRight: { x: .005, y: 0 },
      ArrowUp: { x: 0, y: -.005 }, ArrowDown: { x: 0, y: .005 } };
    const delta = directions[event.key];
    if (!delta) return;
    event.preventDefault(); event.stopPropagation();
    const multiplier = event.shiftKey ? 10 : 1;
    if (handle) {
      const edge = HANDLES.find(item => item.id === handle)!;
      setCrop(resizeCrop(crop, handle, { x: crop.x + edge.x * crop.width + delta.x * multiplier,
        y: crop.y + edge.y * crop.height + delta.y * multiplier }));
    } else setCrop(moveCrop(crop, { x: delta.x * multiplier, y: delta.y * multiplier }));
    setDrawing(false);
  };

  const overlay = <div className="canvas-crop" role="group" aria-label="Crop image on the label"
    onPointerDown={event => event.stopPropagation()}>
    <div ref={surface} className={`crop-surface ${drawing ? "is-drawing" : ""}`}
      style={{ "--crop-aspect": size ? size.width / size.height : 1 } as React.CSSProperties}
      onPointerDown={startGesture} onPointerMove={event => updateGesture(event)} onPointerUp={event => updateGesture(event, true)}
      onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}>
      <img src={image.source} alt="Original image to crop" draggable={false}
        onLoad={event => { const node = event.currentTarget; setSize({ width: node.naturalWidth, height: node.naturalHeight }); }}
        onError={() => setError("The original image could not be loaded. Cancel and import it again.")} />
      {size && <><svg className="crop-shade" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        <path fillRule="evenodd" d={`M0 0H1V1H0Z M${crop.x} ${crop.y}h${crop.width}v${crop.height}h${-crop.width}Z`} /></svg>
        <div className="crop-selection" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
          tabIndex={0} role="group" aria-label="Area to keep. Use arrow keys to move." onKeyDown={event => adjustWithKeyboard(event)}>
          <span className="crop-keep">Keep</span>
          {HANDLES.map(handle => <button key={handle.id} type="button" className="crop-handle" data-crop-handle={handle.id}
            style={{ left: `${handle.x * 100}%`, top: `${handle.y * 100}%`, cursor: `${handle.id}-resize` }}
            aria-label={`Adjust crop ${handle.name}`} onKeyDown={event => adjustWithKeyboard(event, handle.id)} />)}
        </div></>}
    </div>
  </div>;

  return <>
    {createPortal(overlay, paper)}
    <div className="canvas-crop-bar" role="toolbar" aria-label="Crop tools">
      <p className="canvas-crop-message" role="status">{error || qrState.message
        || (drawing ? "Drag a box around the part to keep. It will fill the label." : "Drag the box or its handles. Shaded areas are removed.")}</p>
      <details className="crop-numbers"><summary>Fine-tune with numbers</summary><div>{(["x", "y", "width", "height"] as const).map((field, index) =>
        <label key={field}>{["Left", "Top", "Width", "Height"][index]} (%)<input type="number" min={index < 2 ? 0 : 0.001} max="100" step="0.5"
          value={Math.round(crop[field] * 1000) / 10} onChange={event => { if (event.currentTarget.value === "") return;
            const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) { setCrop(normalizeCrop({ ...crop, [field]: value / 100 })); setDrawing(false); } }} /></label>)}</div></details>
      <div className="canvas-crop-buttons">
        <button className="button" type="button" onClick={() => { void findQr(); }} disabled={!size || qrState.busy}>{qrState.busy ? "Finding…" : "Find QR code"}</button>
        <button className="button" type="button" onClick={() => { setCrop(FULL_CROP); setDrawing(true); setQrState({ busy: false, message: "" }); }}>Reset</button>
        <button className="button" type="button" aria-label={`Rotate label, now ${rotation}°`} onClick={() => setRotation(((rotation + 90) % 360) as Rotation)}>Rotate {rotation}°</button>
        <button className="button button-quiet" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button-primary" type="button" disabled={!pixels || Boolean(error)} onClick={apply}>Use crop</button>
      </div>
    </div>
  </>;
}
