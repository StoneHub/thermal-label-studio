import type { LabelImageCrop } from "@tls/core";

export interface CropRect { x: number; y: number; width: number; height: number }
export interface CropPoint { x: number; y: number }
export type CropHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const MIN_SIZE = 0.000001;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeCrop(rect: CropRect): CropRect {
  const width = clamp(Number.isFinite(rect.width) ? rect.width : 1, MIN_SIZE, 1);
  const height = clamp(Number.isFinite(rect.height) ? rect.height : 1, MIN_SIZE, 1);
  return { x: clamp(Number.isFinite(rect.x) ? rect.x : 0, 0, 1 - width),
    y: clamp(Number.isFinite(rect.y) ? rect.y : 0, 0, 1 - height), width, height };
}

export function drawCrop(start: CropPoint, end: CropPoint): CropRect {
  const a = { x: clamp(start.x, 0, 1), y: clamp(start.y, 0, 1) };
  const b = { x: clamp(end.x, 0, 1), y: clamp(end.y, 0, 1) };
  return normalizeCrop({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) });
}

export function moveCrop(rect: CropRect, delta: CropPoint): CropRect {
  return normalizeCrop({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y });
}

export function resizeCrop(rect: CropRect, handle: CropHandle, point: CropPoint): CropRect {
  let { x: left, y: top } = rect;
  let right = left + rect.width;
  let bottom = top + rect.height;
  if (handle.includes("w")) left = clamp(point.x, 0, right - MIN_SIZE);
  if (handle.includes("e")) right = clamp(point.x, left + MIN_SIZE, 1);
  if (handle.includes("n")) top = clamp(point.y, 0, bottom - MIN_SIZE);
  if (handle.includes("s")) bottom = clamp(point.y, top + MIN_SIZE, 1);
  return normalizeCrop({ x: left, y: top, width: right - left, height: bottom - top });
}

export function cropFromPixels(crop?: LabelImageCrop): CropRect {
  return crop ? { x: crop.x / crop.sourceWidth, y: crop.y / crop.sourceHeight,
    width: crop.width / crop.sourceWidth, height: crop.height / crop.sourceHeight } : FULL_CROP;
}

export function cropToPixels(rect: CropRect, sourceWidth: number, sourceHeight: number): LabelImageCrop {
  const crop = normalizeCrop(rect);
  // Round outward so a selected border or barcode edge is never lost to rounding.
  const x = Math.floor(crop.x * sourceWidth + 1e-7);
  const y = Math.floor(crop.y * sourceHeight + 1e-7);
  return { x, y, width: Math.min(sourceWidth, Math.ceil((crop.x + crop.width) * sourceWidth - 1e-7)) - x,
    height: Math.min(sourceHeight, Math.ceil((crop.y + crop.height) * sourceHeight - 1e-7)) - y, sourceWidth, sourceHeight };
}
