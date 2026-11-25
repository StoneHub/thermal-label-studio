import type {
  LabelDocument,
  LabelElement,
  LabelImageElement,
} from "@tls/core";

export interface Point {
  x: number;
  y: number;
}

export interface ElementGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeCorner {
  x: -1 | 1;
  y: -1 | 1;
}

export interface Size {
  width: number;
  height: number;
}

export const initialDocument: LabelDocument = {
  schemaVersion: 1,
  id: "doc-current-label",
  name: "Untitled label",
  revision: 0,
  size: { width: 800, height: 1200 },
  elements: [],
};

export const withElementGeometry = (
  document: LabelDocument,
  elementId: string,
  geometry: Partial<ElementGeometry>,
): LabelDocument => ({
  ...document,
  elements: document.elements.map((element): LabelElement => element.id === elementId
    ? { ...element, ...geometry }
    : element),
});

const rotate = (point: Point, radians: number): Point => ({
  x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
  y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
});

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(Math.max(value, minimum), maximum)
);

export const frameImageToLabel = (
  image: LabelImageElement,
  label: Size,
): ElementGeometry => {
  const quarterTurn = (image.rotation ?? 0) % 180 !== 0;
  const width = quarterTurn ? label.height : label.width;
  const height = quarterTurn ? label.width : label.height;
  return {
    x: Math.round((label.width - width) / 2),
    y: Math.round((label.height - height) / 2),
    width,
    height,
  };
};

export const constrainImageGeometry = (
  geometry: ElementGeometry,
  rotation: number,
  label: Size,
): ElementGeometry => {
  const quarterTurn = rotation % 180 !== 0;
  const visualWidth = quarterTurn ? geometry.height : geometry.width;
  const visualHeight = quarterTurn ? geometry.width : geometry.height;
  const scale = Math.min(1, label.width / visualWidth, label.height / visualHeight);
  const width = Math.round(geometry.width * scale);
  const height = Math.round(geometry.height * scale);
  const constrainedVisualWidth = quarterTurn ? height : width;
  const constrainedVisualHeight = quarterTurn ? width : height;
  const centerX = clamp(
    geometry.x + geometry.width / 2,
    constrainedVisualWidth / 2,
    label.width - constrainedVisualWidth / 2,
  );
  const centerY = clamp(
    geometry.y + geometry.height / 2,
    constrainedVisualHeight / 2,
    label.height - constrainedVisualHeight / 2,
  );
  return {
    x: Math.round(centerX - width / 2),
    y: Math.round(centerY - height / 2),
    width,
    height,
  };
};

export const resizeImageFromCorner = (
  image: LabelImageElement,
  corner: ResizeCorner,
  pointer: Point,
  label?: Size,
): ElementGeometry => {
  const radians = ((image.rotation ?? 0) * Math.PI) / 180;
  const center = {
    x: image.x + image.width / 2,
    y: image.y + image.height / 2,
  };
  const oppositeFromCenter = rotate({
    x: -corner.x * image.width / 2,
    y: -corner.y * image.height / 2,
  }, radians);
  const opposite = {
    x: center.x + oppositeFromCenter.x,
    y: center.y + oppositeFromCenter.y,
  };
  const pointerFromOpposite = rotate({
    x: pointer.x - opposite.x,
    y: pointer.y - opposite.y,
  }, -radians);
  const diagonal = {
    x: corner.x * image.width,
    y: corner.y * image.height,
  };
  const projectedScale = (
    pointerFromOpposite.x * diagonal.x + pointerFromOpposite.y * diagonal.y
  ) / (image.width ** 2 + image.height ** 2);
  const minimumScale = Math.max(40 / image.width, 40 / image.height);
  const scale = Math.max(minimumScale, projectedScale);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const nextCenterFromOpposite = rotate({
    x: corner.x * width / 2,
    y: corner.y * height / 2,
  }, radians);
  const nextCenter = {
    x: opposite.x + nextCenterFromOpposite.x,
    y: opposite.y + nextCenterFromOpposite.y,
  };

  const geometry = {
    x: Math.round(nextCenter.x - width / 2),
    y: Math.round(nextCenter.y - height / 2),
    width,
    height,
  };
  return label
    ? constrainImageGeometry(geometry, image.rotation ?? 0, label)
    : geometry;
};

/** The PM-241-BT prints 8 dots per millimetre. */
export const LABEL_DOTS_PER_INCH = 203.2;
export const MIN_IMAGE_SCALE_PERCENT = 10;

/** How much the image box could grow, keeping its shape, before it reaches a label edge. */
const growthToFill = (image: LabelImageElement, label: Size): number => {
  const quarterTurn = (image.rotation ?? 0) % 180 !== 0;
  const visualWidth = quarterTurn ? image.height : image.width;
  const visualHeight = quarterTurn ? image.width : image.height;
  return Math.min(label.width / visualWidth, label.height / visualHeight);
};

/** Current image size as a percentage of the largest size that fits the label. */
export const imageScalePercent = (image: LabelImageElement, label: Size): number => (
  Math.min(100, Math.round(100 / growthToFill(image, label)))
);

/**
 * Resize an image about its centre to a percentage of the largest size that
 * fits the label, keeping the box's own shape (and so the content's size
 * within it). 100% touches the label edges, so a tight crop prints as large
 * as the label allows.
 */
export const scaleImageToPercent = (
  image: LabelImageElement,
  label: Size,
  percent: number,
): ElementGeometry => {
  const ratio = clamp(Number.isFinite(percent) ? percent : 100, MIN_IMAGE_SCALE_PERCENT, 100) / 100;
  const factor = growthToFill(image, label) * ratio;
  const width = Math.max(1, Math.round(image.width * factor));
  const height = Math.max(1, Math.round(image.height * factor));
  const centerX = image.x + image.width / 2;
  const centerY = image.y + image.height / 2;
  return constrainImageGeometry({
    x: Math.round(centerX - width / 2),
    y: Math.round(centerY - height / 2),
    width,
    height,
  }, image.rotation ?? 0, label);
};

/**
 * Printed size of a cropped image's kept pixels, in inches, as the label shows
 * it. Returns null when the source size is unknown (an uncropped image).
 */
export const printedCropSize = (image: LabelImageElement): Size | null => {
  const crop = image.crop;
  if (!crop || crop.width <= 0 || crop.height <= 0) return null;
  const fit = image.fit === "cover" ? Math.max : Math.min;
  const scale = fit(image.width / crop.width, image.height / crop.height);
  const width = Math.min(image.width, crop.width * scale) / LABEL_DOTS_PER_INCH;
  const height = Math.min(image.height, crop.height * scale) / LABEL_DOTS_PER_INCH;
  return (image.rotation ?? 0) % 180 === 0 ? { width, height } : { width: height, height: width };
};
