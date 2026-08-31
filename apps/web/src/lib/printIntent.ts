import type { RenderArtifact } from "@tls/core";

export const LABEL_PRINTER_PROFILE = Object.freeze({
  id: "offnova-n6140-4x6",
  width: 800,
  height: 1200,
});

export interface LabelPrintIntent {
  readonly taskId: string;
  readonly maxAttempts: 1;
  readonly printerProfileId: typeof LABEL_PRINTER_PROFILE.id;
  readonly artifact: {
    readonly documentId: string;
    readonly revision: number;
    readonly width: number;
    readonly height: number;
    readonly mimeType: "image/x-portable-bitmap";
    readonly sha256: string;
    readonly blackPixelCount: number;
    readonly dataBase64: string;
  };
}

export interface TransportReceipt {
  readonly taskId: string;
  readonly accepted: boolean;
  readonly state: "accepted" | "rejected";
  readonly detail: string;
}

export interface PackedMonochromeBitmap {
  readonly bytes: Uint8Array;
  readonly blackPixelCount: number;
}

/** Pack RGBA pixels as a binary PBM. A set bit means the thermal head prints black. */
export function packMonochromePbm(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 168,
): PackedMonochromeBitmap {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Print dimensions must be positive integers.");
  }
  if (rgba.length !== width * height * 4) {
    throw new Error("Pixel data does not match the print dimensions.");
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) {
    throw new Error("Monochrome threshold must be between 0 and 255.");
  }

  const header = new TextEncoder().encode(`P4\n${width} ${height}\n`);
  const rowBytes = Math.ceil(width / 8);
  const bytes = new Uint8Array(header.length + rowBytes * height);
  bytes.set(header);
  let blackPixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const alpha = rgba[pixel + 3];
      const luminance = (rgba[pixel] * 299 + rgba[pixel + 1] * 587 + rgba[pixel + 2] * 114) / 1000;
      if (alpha >= 128 && luminance < threshold) {
        bytes[header.length + y * rowBytes + Math.floor(x / 8)] |= 1 << (7 - (x % 8));
        blackPixelCount += 1;
      }
    }
  }

  return Object.freeze({ bytes, blackPixelCount });
}

function encodeBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes.length);
  input.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input.buffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function rasterize(artifact: RenderArtifact): Promise<Uint8ClampedArray> {
  const blob = new Blob([artifact.source], { type: artifact.mimeType });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = artifact.width;
    canvas.height = artifact.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser cannot prepare a print bitmap.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareLabelPrintIntent(artifact: RenderArtifact): Promise<LabelPrintIntent> {
  if (artifact.width !== LABEL_PRINTER_PROFILE.width || artifact.height !== LABEL_PRINTER_PROFILE.height) {
    throw new Error(`The OFFNOVA profile requires ${LABEL_PRINTER_PROFILE.width} × ${LABEL_PRINTER_PROFILE.height}.`);
  }
  const packed = packMonochromePbm(await rasterize(artifact), artifact.width, artifact.height);
  if (packed.blackPixelCount === 0) throw new Error("The prepared label has no black pixels.");
  return Object.freeze({
    taskId: crypto.randomUUID(),
    maxAttempts: 1,
    printerProfileId: LABEL_PRINTER_PROFILE.id,
    artifact: Object.freeze({
      documentId: artifact.documentId,
      revision: artifact.revision,
      width: artifact.width,
      height: artifact.height,
      mimeType: "image/x-portable-bitmap" as const,
      sha256: await sha256(packed.bytes),
      blackPixelCount: packed.blackPixelCount,
      dataBase64: encodeBase64(packed.bytes),
    }),
  });
}

export async function submitLabelPrintIntent(intent: LabelPrintIntent): Promise<TransportReceipt> {
  const response = await fetch("./api/print-label-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intent),
  });
  const body = await response.json().catch(() => ({ detail: `Print node returned HTTP ${response.status}.` })) as Partial<TransportReceipt>;
  if (!response.ok || body.accepted !== true || body.state !== "accepted") {
    throw new Error(typeof body.detail === "string" ? body.detail : "The print node rejected the label.");
  }
  return Object.freeze({
    taskId: typeof body.taskId === "string" ? body.taskId : intent.taskId,
    accepted: true,
    state: "accepted",
    detail: typeof body.detail === "string" ? body.detail : "The print node accepted the label once.",
  });
}
