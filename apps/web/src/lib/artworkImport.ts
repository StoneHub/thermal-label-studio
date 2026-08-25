/**
 * Browser-only artwork import helpers.
 *
 * PDF support requires `pdfjs-dist@6.2.108` in the web application's
 * dependencies. The package is loaded only when a PDF is imported so regular
 * image imports do not pay the PDF loading cost.
 */

export type ArtworkSourceKind = "image" | "pdf-page";

export type ArtworkFileKind = "image" | "pdf" | "unsupported";

export interface ImportedArtwork {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  sourceKind: ArtworkSourceKind;
}

export interface ArtworkSize {
  width: number;
  height: number;
}

export interface ArtworkMargins {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface ArtworkPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const PDF_MIME_TYPES = new Set(["application/pdf"]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);

const PDF_EXTENSIONS = new Set(["pdf"]);

const FILE_ACCEPT_HINT = "PNG, JPEG, WebP, GIF, SVG, or PDF";
const MAX_RASTER_DIMENSION = 4096;

/**
 * Classify a file using its MIME type first, then its extension. Clipboard
 * files often have a blank MIME type or an unhelpful name, so both signals
 * matter here.
 */
export const classifyArtworkFile = (
  file: Pick<File, "name" | "type">
): ArtworkFileKind => {
  const mimeType = file.type.trim().toLowerCase().split(";", 1)[0];

  if (PDF_MIME_TYPES.has(mimeType)) return "pdf";
  if (IMAGE_MIME_TYPES.has(mimeType)) return "image";

  if (
    mimeType &&
    mimeType !== "application/octet-stream" &&
    mimeType !== "binary/octet-stream" &&
    mimeType !== "text/plain"
  ) {
    return "unsupported";
  }

  const extension = file.name.trim().toLowerCase().split(".").pop() ?? "";
  if (PDF_EXTENSIONS.has(extension)) return "pdf";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";

  return "unsupported";
};

const isFinitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

const requireSize = (size: ArtworkSize, label: string): void => {
  if (!isFinitePositive(size.width) || !isFinitePositive(size.height)) {
    throw new RangeError(`${label} width and height must be positive finite numbers.`);
  }
};

const normalizeMargins = (
  margins: number | ArtworkMargins
): Required<ArtworkMargins> => {
  if (typeof margins === "number") {
    if (!Number.isFinite(margins) || margins < 0) {
      throw new RangeError("Artwork margin must be a finite non-negative number.");
    }

    return { top: margins, right: margins, bottom: margins, left: margins };
  }

  const normalized = {
    top: margins.top ?? 0,
    right: margins.right ?? 0,
    bottom: margins.bottom ?? 0,
    left: margins.left ?? 0,
  };

  if (Object.values(normalized).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("Artwork margins must be finite non-negative numbers.");
  }

  return normalized;
};

export function fitArtworkWithin(
  artwork: ArtworkSize,
  label: ArtworkSize,
  margins: number | ArtworkMargins = 0
): ArtworkPlacement {
  requireSize(artwork, "Artwork");
  requireSize(label, "Label");
  const { top, right, bottom, left } = normalizeMargins(margins);
  const availableWidth = label.width - left - right;
  const availableHeight = label.height - top - bottom;

  if (!isFinitePositive(availableWidth) || !isFinitePositive(availableHeight)) {
    throw new RangeError("Artwork margins must leave positive space inside the label.");
  }

  const scale = Math.min(availableWidth / artwork.width, availableHeight / artwork.height);
  const width = artwork.width * scale;
  const height = artwork.height * scale;

  return {
    x: left + (availableWidth - width) / 2,
    y: top + (availableHeight - height) / 2,
    width,
    height,
  };
}

const createRasterCanvas = (width: number, height: number): HTMLCanvasElement => {
  if (typeof document === "undefined") {
    throw new Error("Artwork import requires a browser canvas.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  if (!canvas.getContext("2d")) {
    throw new Error("This browser could not create a 2D canvas for artwork import.");
  }

  return canvas;
};

const canvasDataUrl = (canvas: HTMLCanvasElement): string => {
  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`The artwork could not be rasterized to PNG.${detail}`);
  }
};

const loadWithImageElement = async (file: File): Promise<HTMLImageElement> => {
  if (typeof Image === "undefined" || typeof URL === "undefined") {
    throw new Error("This browser cannot decode image artwork.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image data could not be decoded."));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const rasterizeImage = async (file: File): Promise<Pick<ImportedArtwork, "dataUrl" | "width" | "height">> => {
  let bitmap: ImageBitmap | undefined;

  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // SVG and some clipboard formats are not supported by createImageBitmap.
      // The image-element path below handles those formats in browsers that do.
    }
  }

  if (bitmap) {
    try {
      if (!isFinitePositive(bitmap.width) || !isFinitePositive(bitmap.height)) {
        throw new Error("The decoded image has no usable dimensions.");
      }

      const scale = Math.min(1, MAX_RASTER_DIMENSION / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = createRasterCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not create a 2D canvas for artwork import.");
      context.drawImage(bitmap, 0, 0, width, height);
      return { dataUrl: canvasDataUrl(canvas), width, height };
    } finally {
      bitmap.close();
    }
  }

  const image = await loadWithImageElement(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!isFinitePositive(width) || !isFinitePositive(height)) {
    throw new Error("The decoded image has no usable dimensions.");
  }

  const scale = Math.min(1, MAX_RASTER_DIMENSION / Math.max(width, height));
  const rasterWidth = Math.max(1, Math.round(width * scale));
  const rasterHeight = Math.max(1, Math.round(height * scale));
  const canvas = createRasterCanvas(rasterWidth, rasterHeight);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create a 2D canvas for artwork import.");
  context.drawImage(image, 0, 0, rasterWidth, rasterHeight);
  return { dataUrl: canvasDataUrl(canvas), width: rasterWidth, height: rasterHeight };
};

const rasterizePdfPage = async (
  file: File
): Promise<Pick<ImportedArtwork, "dataUrl" | "width" | "height">> => {
  // Keep the worker import next to the PDF import. It avoids loading PDF.js
  // for image-only sessions and lets Vite turn the worker into an asset URL.
  const [pdfjs, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

  const bytes = new Uint8Array(await file.arrayBuffer());
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
  let documentProxy: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]> | undefined;

  try {
    loadingTask = pdfjs.getDocument({ data: bytes });
    documentProxy = await loadingTask.promise;
    if (documentProxy.numPages < 1) {
      throw new Error("The PDF does not contain a page to import.");
    }

    const page = await documentProxy.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const maxDimension = Math.max(baseViewport.width, baseViewport.height);
    const scale = Math.min(2, 4096 / maxDimension);
    const viewport = page.getViewport({ scale });
    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const canvas = createRasterCanvas(width, height);
    await page.render({ canvas, viewport }).promise;
    return { dataUrl: canvasDataUrl(canvas), width, height };
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not contain a page")) throw error;
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`The PDF could not be rendered.${detail}`);
  } finally {
    await documentProxy?.cleanup();
    await loadingTask?.destroy();
  }
};

export const importArtwork = async (file: File): Promise<ImportedArtwork> => {
  if (!file || file.size <= 0) {
    throw new Error("That file is empty.");
  }

  const fileKind = classifyArtworkFile(file);
  if (fileKind === "unsupported") {
    const name = file.name.trim() || "this file";
    throw new Error(`"${name}" is not supported. Use ${FILE_ACCEPT_HINT}.`);
  }

  try {
    const raster = fileKind === "pdf" ? await rasterizePdfPage(file) : await rasterizeImage(file);
    return {
      name: file.name.trim() || "Pasted image",
      ...raster,
      sourceKind: fileKind === "pdf" ? "pdf-page" : "image",
    };
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("The PDF") || error.message.startsWith("The image"))) {
      throw error;
    }
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`"${file.name || "That file"}" could not be opened.${detail}`);
  }
};
