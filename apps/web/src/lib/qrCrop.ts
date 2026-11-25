import type jsQRType from "jsqr";
import { normalizeCrop, type CropRect } from "./imageCrop";

export interface QrPoint { x: number; y: number }
export interface QrCorners {
  topLeft: QrPoint;
  topRight: QrPoint;
  bottomRight: QrPoint;
  bottomLeft: QrPoint;
}
export interface FoundQrCode {
  /** Normalized crop that keeps the code and its quiet zone. */
  crop: CropRect;
  /** Decoded text, useful as a check that the right code was found. */
  data: string;
  /** Source pixels per QR module, before scaling to the label. */
  modulePixels: number;
}

/** The QR specification asks for four white modules around the symbol. */
export const QR_QUIET_ZONE_MODULES = 4;
/** Detection runs on a copy no larger than this, then on the full image if needed. */
const DETECTION_MAX_SIDE = 1600;

/**
 * Expand a detected QR symbol to an axis-aligned crop that keeps its quiet zone.
 *
 * jsQR reports the outer corners of the symbol in source pixels. The symbol is
 * `17 + 4 * version` modules wide, so the module size comes from the measured
 * side length. Scanners need the white quiet zone, and the label edge is not a
 * reliable substitute because the printer cannot print to the very edge.
 */
export function qrCropFromCorners(
  corners: QrCorners,
  version: number,
  sourceWidth: number,
  sourceHeight: number,
  quietZoneModules = QR_QUIET_ZONE_MODULES,
): { crop: CropRect; modulePixels: number } {
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const side = (distance(corners.topLeft, corners.topRight) + distance(corners.topRight, corners.bottomRight)
    + distance(corners.bottomRight, corners.bottomLeft) + distance(corners.bottomLeft, corners.topLeft)) / 4;
  const modules = 17 + 4 * Math.max(1, Math.round(version));
  const modulePixels = side / modules;
  const margin = modulePixels * quietZoneModules;
  const left = Math.max(0, Math.min(...xs) - margin);
  const top = Math.max(0, Math.min(...ys) - margin);
  const right = Math.min(sourceWidth, Math.max(...xs) + margin);
  const bottom = Math.min(sourceHeight, Math.max(...ys) + margin);
  return {
    crop: normalizeCrop({ x: left / sourceWidth, y: top / sourceHeight,
      width: (right - left) / sourceWidth, height: (bottom - top) / sourceHeight }),
    modulePixels,
  };
}

const distance = (a: QrPoint, b: QrPoint) => Math.hypot(a.x - b.x, a.y - b.y);

function detect(jsQR: typeof jsQRType, image: CanvasImageSource, width: number, height: number, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot inspect the image for a QR code.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
}

/** Find the first QR code in an image and return the crop that keeps it. */
export async function findQrCode(source: string): Promise<FoundQrCode | null> {
  // The decoder loads only when someone asks for it, keeping the editor's first load small.
  const { default: jsQR } = await import("jsqr");
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const scales = [Math.min(1, DETECTION_MAX_SIDE / Math.max(width, height))];
  if (scales[0] < 1) scales.push(1);
  for (const scale of scales) {
    const code = detect(jsQR, image, width, height, scale);
    if (!code) continue;
    const toSource = (point: QrPoint) => ({ x: point.x / scale, y: point.y / scale });
    const { crop, modulePixels } = qrCropFromCorners({
      topLeft: toSource(code.location.topLeftCorner),
      topRight: toSource(code.location.topRightCorner),
      bottomRight: toSource(code.location.bottomRightCorner),
      bottomLeft: toSource(code.location.bottomLeftCorner),
    }, code.version, width, height);
    return { crop, data: code.data, modulePixels };
  }
  return null;
}
