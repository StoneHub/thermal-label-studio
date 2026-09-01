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
