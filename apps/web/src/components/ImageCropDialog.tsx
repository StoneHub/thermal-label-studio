import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderLabelDocument, type LabelDocument, type LabelImageCrop, type LabelImageElement, type LabelTextMeasure } from "@tls/core";
import { frameImageToLabel } from "../lib/editorModel";
import { cropFromPixels, cropToPixels, drawCrop, FULL_CROP, moveCrop, normalizeCrop, resizeCrop,
  type CropHandle, type CropPoint, type CropRect } from "../lib/imageCrop";

const HANDLES: Array<{ id: CropHandle; name: string; x: number; y: number }> = [
  { id: "nw", name: "top left", x: 0, y: 0 }, { id: "n", name: "top", x: .5, y: 0 },
  { id: "ne", name: "top right", x: 1, y: 0 }, { id: "e", name: "right", x: 1, y: .5 },
  { id: "se", name: "bottom right", x: 1, y: 1 }, { id: "s", name: "bottom", x: .5, y: 1 },
  { id: "sw", name: "bottom left", x: 0, y: 1 }, { id: "w", name: "left", x: 0, y: .5 },
];
type Gesture = { pointerId: number; start: CropPoint; original: CropRect; mode: "draw" | "move" | CropHandle };
interface Props {
  document: LabelDocument;
  image: LabelImageElement;
  measureText: LabelTextMeasure;
  onCancel: () => void;
  onApply: (crop: LabelImageCrop | null, rotation: NonNullable<LabelImageElement["rotation"]>) => void;
}

export function ImageCropDialog({ document, image, measureText, onCancel, onApply }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [crop, setCrop] = useState(() => cropFromPixels(image.crop));
  const [drawing, setDrawing] = useState(!image.crop);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState("");
  const [rotation, setRotation] = useState<NonNullable<LabelImageElement["rotation"]>>(image.rotation ?? 0);

  useEffect(() => {
    const node = dialog.current;
    const previousFocus = window.document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const originalCrop = cropFromPixels(image.crop);
  const unchanged = image.crop && size?.width === image.crop.sourceWidth && size.height === image.crop.sourceHeight
    && Object.keys(crop).every(key => crop[key as keyof CropRect] === originalCrop[key as keyof CropRect]);
  const pixels = unchanged ? image.crop! : size ? cropToPixels(crop, size.width, size.height) : null;
  const preview = useMemo(() => {
    if (!pixels) return "";
    const nextImage = { ...image, crop: pixels, rotation, fit: "contain" as const };
    const geometry = frameImageToLabel(nextImage, document.size);
    return renderLabelDocument({ ...document, elements: document.elements.map(element =>
      element.id === image.id ? { ...nextImage, ...geometry } : element) }, { measureText }).source;
  }, [document, image, measureText, pixels?.x, pixels?.y, pixels?.width, pixels?.height, pixels?.sourceWidth, pixels?.sourceHeight, rotation]);

  const point = (event: React.PointerEvent): CropPoint => {
    const rect = surface.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  const nextCrop = (active: Gesture, end: CropPoint) => active.mode === "draw" ? drawCrop(active.start, end)
    : active.mode === "move" ? moveCrop(active.original, { x: end.x - active.start.x, y: end.y - active.start.y })
    : resizeCrop(active.original, active.mode, end);
  const startGesture = (event: React.PointerEvent<HTMLDivElement>) => {
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

  return <dialog ref={dialog} className="crop-dialog" aria-labelledby="crop-title" aria-describedby="crop-help"
    onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <div className="crop-heading"><h2 id="crop-title">Crop to the label</h2><button className="button button-quiet" onClick={onCancel}>Cancel</button></div>
    <p id="crop-help" className="crop-help">Drag a box around the label. Adjust the handles or move the box. Shaded areas will be removed.</p>
    <div className="crop-tools"><button className={`button ${drawing ? "button-primary" : ""}`} aria-pressed={drawing} onClick={() => setDrawing(true)}>Draw new box</button>
      <button className="button" onClick={() => { setCrop(FULL_CROP); setDrawing(true); }}>Reset to full page</button></div>
    {error && <p role="alert">{error}</p>}
    <div className="crop-workspace">
      <div className="crop-stage"><div ref={surface} className={`crop-surface ${drawing ? "is-drawing" : ""}`}
        style={{ "--crop-aspect": size ? size.width / size.height : 1 } as React.CSSProperties}
        onPointerDown={startGesture} onPointerMove={event => updateGesture(event)} onPointerUp={event => updateGesture(event, true)}
        onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}>
        <img src={image.source} alt="Original page to crop" draggable={false}
          onLoad={event => { const node = event.currentTarget; setSize({ width: node.naturalWidth, height: node.naturalHeight }); }}
          onError={() => setError("The original image could not be loaded. Cancel and import it again.")} />
        {size && <><svg className="crop-shade" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <path fillRule="evenodd" d={`M0 0H1V1H0Z M${crop.x} ${crop.y}h${crop.width}v${crop.height}h${-crop.width}Z`} /></svg>
          <div className="crop-selection" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
            tabIndex={0} role="group" aria-label="Area to keep. Use arrow keys to move." onKeyDown={event => adjustWithKeyboard(event)}>
            <span className="crop-keep">Keep this area</span>
            {HANDLES.map(handle => <button key={handle.id} type="button" className="crop-handle" data-crop-handle={handle.id}
              style={{ left: `${handle.x * 100}%`, top: `${handle.y * 100}%`, cursor: `${handle.id}-resize` }}
              aria-label={`Adjust crop ${handle.name}`} onKeyDown={event => adjustWithKeyboard(event, handle.id)} />)}
          </div></>}
      </div></div>
      <div className="crop-preview-panel"><div className="crop-preview" aria-label="Cropped label preview" dangerouslySetInnerHTML={{ __html: preview }} />
        <div><strong>Label preview</strong><p className="control-help">Keep all barcodes and a little white space around them. Nothing outside your box will print.</p>
          <button className="button" onClick={() => setRotation(((rotation + 90) % 360) as typeof rotation)}>Rotate label ↻</button></div>
      </div>
    </div>
    <details className="crop-numbers"><summary>Fine-tune with numbers</summary><div>{(["x", "y", "width", "height"] as const).map((field, index) =>
      <label key={field}>{["Left", "Top", "Width", "Height"][index]} (%)<input type="number" min={index < 2 ? 0 : 0.001} max="100" step="0.5"
        value={Math.round(crop[field] * 1000) / 10} onChange={event => { if (event.currentTarget.value === "") return;
          const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) { setCrop(normalizeCrop({ ...crop, [field]: value / 100 })); setDrawing(false); } }} /></label>)}</div></details>
    <div className="crop-footer"><p>Your original stays intact. You can change this crop later or Undo.</p><button className="button button-primary" disabled={!pixels || Boolean(error)} onClick={() => {
      if (pixels) onApply(crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1 ? null : pixels, rotation);
    }}>Use crop</button></div>
  </dialog>;
}
