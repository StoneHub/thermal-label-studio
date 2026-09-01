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

export const resizeImageFromCorner = (
  image: LabelImageElement,
  corner: ResizeCorner,
  pointer: Point,
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

  return {
    x: Math.round(nextCenter.x - width / 2),
    y: Math.round(nextCenter.y - height / 2),
    width,
    height,
  };
};
