import { locateShippingLabel, type BarcodeHit, type FoundShippingLabel, type QuarterTurn } from "./labelCrop";
import { findQrCode, type FoundQrCode } from "./qrCrop";

export type FoundCode = ({ kind: "label"; qrSeen: boolean } & FoundShippingLabel) | ({ kind: "qr" } & FoundQrCode);

/** Bar code search runs on a copy no larger than this, then on the full image if needed. */
const DETECTION_MAX_SIDE = 2000;
/** zbar orientation (up, right, down, left) to the clockwise turn that stands the code upright. */
const TURNS: Record<number, QuarterTurn> = { 0: 0, 1: 270, 2: 180, 3: 90 };

type Zbar = typeof import("@undecaf/zbar-wasm");
let zbar: Promise<Zbar> | undefined;
/** The decoder and its WebAssembly load only when someone asks for them. */
function loadZbar(): Promise<Zbar> {
  zbar ??= Promise.all([import("@undecaf/zbar-wasm"), import("@undecaf/zbar-wasm/dist/zbar.wasm?url")])
    .then(([module, wasm]) => {
      module.setModuleArgs({ locateFile: file => file.endsWith(".wasm") ? wasm.default : file });
      return module;
    })
    .catch(error => { zbar = undefined; throw error; });
  return zbar;
}

function grayPixels(image: HTMLImageElement, scale: number) {
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot inspect the image for codes.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    gray[index] = (rgba[offset] * 299 + rgba[offset + 1] * 587 + rgba[offset + 2] * 114) / 1000;
  }
  canvas.width = canvas.height = 0;
  return { gray, width, height };
}

/**
 * Find a shipping label (the block of the page around its bar codes, turned
 * upright) or, when the image has no bar codes, a QR code with its quiet zone.
 */
export async function findLabelOrQr(source: string): Promise<FoundCode | null> {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
  const { scanGrayBuffer } = await loadZbar();
  const first = Math.min(1, DETECTION_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  for (const scale of first < 1 ? [first, 1] : [1]) {
    const { gray, width, height } = grayPixels(image, scale);
    const symbols = await scanGrayBuffer(gray.slice().buffer, width, height);
    const hits: BarcodeHit[] = symbols.filter(symbol => symbol.points.length).map(symbol => ({
      linear: symbol.typeName !== "ZBAR_QRCODE" && symbol.typeName !== "ZBAR_SQCODE",
      turn: TURNS[symbol.orientation] ?? null,
      box: {
        left: Math.min(...symbol.points.map(point => point.x)), top: Math.min(...symbol.points.map(point => point.y)),
        right: Math.max(...symbol.points.map(point => point.x)) + 1, bottom: Math.max(...symbol.points.map(point => point.y)) + 1,
      },
    }));
    const label = locateShippingLabel(gray, width, height, hits);
    if (label) return { kind: "label", qrSeen: hits.some(hit => !hit.linear), ...label };
  }
  const qr = await findQrCode(source);
  return qr && { kind: "qr", ...qr };
}
