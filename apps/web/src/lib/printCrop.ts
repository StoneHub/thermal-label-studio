import type { LabelDocument, LabelElement, LabelImageElement } from "@tls/core";

const loadImage = async (source: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
  return image;
};

/**
 * Replace each cropped image with a bitmap holding only the kept pixels.
 *
 * The SVG renderer crops by clipping the whole source. Rasterizers smooth and
 * antialias across that clip edge, so a border or cut line just outside the
 * crop can print as a thin black line. Print preparation must never hand the
 * rasterizer pixels the person discarded.
 */
async function bakeImageCrop(element: LabelImageElement): Promise<LabelImageElement> {
  const crop = element.crop;
  if (!crop) return element;
  const image = await loadImage(element.source);
  if (image.naturalWidth !== crop.sourceWidth || image.naturalHeight !== crop.sourceHeight) {
    throw new Error("Cropped artwork changed size. Crop it again before printing.");
  }
  const { x: left, y: top } = crop;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) throw new Error("The cropped artwork has no pixels to print.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare cropped artwork for printing.");
  context.imageSmoothingEnabled = false;
  context.drawImage(image, left, top, width, height, 0, 0, width, height);
  return { ...element, source: canvas.toDataURL("image/png"),
    crop: { x: 0, y: 0, width, height, sourceWidth: width, sourceHeight: height } };
}

export async function bakeImageCrops(document: LabelDocument): Promise<LabelDocument> {
  if (!document.elements.some((element) => element.type === "image" && element.crop)) return document;
  const elements: LabelElement[] = [];
  for (const element of document.elements) elements.push(element.type === "image" ? await bakeImageCrop(element) : element);
  return { ...document, elements };
}
