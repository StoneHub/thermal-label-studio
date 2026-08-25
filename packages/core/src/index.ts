// ── Units & Size ─────────────────────────────────────────────────

export type LabelUnit = "px" | "mm";

export interface LabelSize {
  width: number;
  height: number;
  unit: LabelUnit;
}

// ── Layer Types ──────────────────────────────────────────────────

interface BaseLayer {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;
}

export interface LabelTextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  fill?: string;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface LabelImageLayer extends BaseLayer {
  type: "image";
  source: string;
  fit?: "contain" | "cover" | "fill";
}

export interface LabelShapeLayer extends BaseLayer {
  type: "shape";
  shapeType: "rect" | "circle" | "line";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export type LabelLayer = LabelTextLayer | LabelImageLayer | LabelShapeLayer;

// ── Template ─────────────────────────────────────────────────────

export interface TemplateField {
  type: "text" | "image";
  label: string;
  default?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}

export interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  category?: LabelCategory;
  tags?: string[];
  size: LabelSize;
  layers: LabelLayer[];
  fields?: Record<string, TemplateField>;
}

export interface RenderResult {
  ok: boolean;
  format: "png" | "tspl";
  widthPx: number;
  heightPx: number;
  notes: string[];
}

export type LabelCategory = "full" | "sticker";

// ── Constants ────────────────────────────────────────────────────

export const THERMAL_DPI = 203;
export const MM_PER_INCH = 25.4;
export const THERMAL_4X6_MM = { width: 101.6, height: 152.4 };
export const THERMAL_4X6_PX = { width: 812, height: 1218 };
export const CANVAS_TARGET = { width: 800, height: 1200 };

// ── Conversion helpers ───────────────────────────────────────────

export const mmToPxAt203Dpi = (mm: number): number =>
  Math.round((mm / MM_PER_INCH) * THERMAL_DPI);

export const toPixels = (value: number, unit: LabelUnit): number =>
  unit === "mm" ? mmToPxAt203Dpi(value) : Math.round(value);

// ── Template helpers ─────────────────────────────────────────────

let _idCounter = 0;
export const generateId = (): string =>
  `layer_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;

export const createEmptyTemplate = (id = "new-template"): LabelTemplate => ({
  id,
  name: "Untitled Label",
  size: { width: CANVAS_TARGET.width, height: CANVAS_TARGET.height, unit: "px" },
  layers: [],
});

export const renderLabelStub = (template: LabelTemplate): RenderResult => {
  const widthPx = toPixels(template.size.width, template.size.unit);
  const heightPx = toPixels(template.size.height, template.size.unit);
  return {
    ok: true,
    format: "png",
    widthPx,
    heightPx,
    notes: [
      "Render pipeline stub only.",
      `Layer count: ${template.layers.length}`,
    ],
  };
};

export const extractPlaceholders = (template: LabelTemplate): string[] => {
  const set = new Set<string>();
  for (const layer of template.layers) {
    let source = "";
    if (layer.type === "text") source = layer.text;
    else if (layer.type === "image") source = layer.source;
    for (const match of source.matchAll(/\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g)) {
      set.add(match[1]);
    }
  }
  return [...set];
};

export const applyFieldOverrides = (
  template: LabelTemplate,
  overrides: Record<string, string>
): LabelTemplate => {
  const replace = (input: string): string =>
    input.replace(/\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g, (_full, key: string) =>
      overrides[key] ?? `{{${key}}}`
    );

  return {
    ...template,
    layers: template.layers.map((layer) => {
      if (layer.type === "text") return { ...layer, text: replace(layer.text) };
      if (layer.type === "image") return { ...layer, source: replace(layer.source) };
      return layer;
    }),
  };
};

export const inferTemplateCategory = (template: LabelTemplate): LabelCategory =>
  template.category ?? (template.id.includes("sticker") ? "sticker" : "full");

// ── Layer manipulation helpers ───────────────────────────────────

export const createTextLayer = (overrides: Partial<LabelTextLayer> = {}): LabelTextLayer => ({
  id: generateId(),
  type: "text",
  x: 50,
  y: 50,
  width: 300,
  height: 40,
  text: "New Text",
  fontSize: 24,
  fontFamily: "Inter",
  fontWeight: 400,
  align: "left",
  fill: "#000000",
  ...overrides,
});

export const createShapeLayer = (overrides: Partial<LabelShapeLayer> = {}): LabelShapeLayer => ({
  id: generateId(),
  type: "shape",
  shapeType: "rect",
  x: 50,
  y: 50,
  width: 200,
  height: 100,
  fill: "#e0e0e0",
  stroke: "#333333",
  strokeWidth: 2,
  cornerRadius: 0,
  ...overrides,
});

export const createImageLayer = (overrides: Partial<LabelImageLayer> = {}): LabelImageLayer => ({
  id: generateId(),
  type: "image",
  x: 50,
  y: 50,
  width: 200,
  height: 200,
  source: "",
  fit: "contain",
  ...overrides,
});

export const duplicateLayer = (layer: LabelLayer): LabelLayer => ({
  ...layer,
  id: generateId(),
  x: layer.x + 20,
  y: layer.y + 20,
});

export const moveLayer = (
  layer: LabelLayer,
  dx: number,
  dy: number
): LabelLayer => ({
  ...layer,
  x: layer.x + dx,
  y: layer.y + dy,
});

export const resizeLayer = (
  layer: LabelLayer,
  width: number,
  height: number
): LabelLayer => ({
  ...layer,
  width: Math.max(10, width),
  height: Math.max(10, height),
});

export const rotateLayer = (
  layer: LabelLayer,
  rotation: number
): LabelLayer => ({
  ...layer,
  rotation,
});

// ── Snap / Alignment helpers ─────────────────────────────────────

export interface SnapLine {
  orientation: "horizontal" | "vertical";
  position: number;
}

export const SNAP_THRESHOLD = 6;

export const getLayerEdges = (layer: LabelLayer) => ({
  left: layer.x,
  right: layer.x + layer.width,
  top: layer.y,
  bottom: layer.y + layer.height,
  centerX: layer.x + layer.width / 2,
  centerY: layer.y + layer.height / 2,
});

export const computeSnapLines = (
  movingLayer: LabelLayer,
  otherLayers: LabelLayer[],
  canvasWidth: number,
  canvasHeight: number
): { snappedX: number | null; snappedY: number | null; lines: SnapLine[] } => {
  const moving = getLayerEdges(movingLayer);
  const lines: SnapLine[] = [];
  let snappedX: number | null = null;
  let snappedY: number | null = null;

  // Canvas edges + center
  const vGuides = [0, canvasWidth / 2, canvasWidth];
  const hGuides = [0, canvasHeight / 2, canvasHeight];

  // Other layer edges
  for (const other of otherLayers) {
    if (other.id === movingLayer.id) continue;
    const e = getLayerEdges(other);
    vGuides.push(e.left, e.right, e.centerX);
    hGuides.push(e.top, e.bottom, e.centerY);
  }

  // Check vertical snaps (x-axis)
  const movingVPoints = [moving.left, moving.centerX, moving.right];
  for (const guide of vGuides) {
    for (let i = 0; i < movingVPoints.length; i++) {
      const diff = guide - movingVPoints[i];
      if (Math.abs(diff) <= SNAP_THRESHOLD) {
        snappedX = movingLayer.x + diff;
        lines.push({ orientation: "vertical", position: guide });
        break;
      }
    }
    if (snappedX !== null) break;
  }

  // Check horizontal snaps (y-axis)
  const movingHPoints = [moving.top, moving.centerY, moving.bottom];
  for (const guide of hGuides) {
    for (let i = 0; i < movingHPoints.length; i++) {
      const diff = guide - movingHPoints[i];
      if (Math.abs(diff) <= SNAP_THRESHOLD) {
        snappedY = movingLayer.y + diff;
        lines.push({ orientation: "horizontal", position: guide });
        break;
      }
    }
    if (snappedY !== null) break;
  }

  return { snappedX, snappedY, lines };
};

// ── Alignment actions ────────────────────────────────────────────

export type AlignAction =
  | "align-left"
  | "align-center-h"
  | "align-right"
  | "align-top"
  | "align-center-v"
  | "align-bottom"
  | "distribute-h"
  | "distribute-v";

export const alignLayers = (
  layers: LabelLayer[],
  action: AlignAction,
  canvasWidth: number,
  canvasHeight: number
): LabelLayer[] => {
  if (layers.length === 0) return layers;

  switch (action) {
    case "align-left":
      return layers.map((l) => ({ ...l, x: 0 }));
    case "align-right":
      return layers.map((l) => ({ ...l, x: canvasWidth - l.width }));
    case "align-center-h":
      return layers.map((l) => ({ ...l, x: (canvasWidth - l.width) / 2 }));
    case "align-top":
      return layers.map((l) => ({ ...l, y: 0 }));
    case "align-bottom":
      return layers.map((l) => ({ ...l, y: canvasHeight - l.height }));
    case "align-center-v":
      return layers.map((l) => ({ ...l, y: (canvasHeight - l.height) / 2 }));
    case "distribute-h": {
      if (layers.length < 3) return layers;
      const sorted = [...layers].sort((a, b) => a.x - b.x);
      const totalWidth = sorted.reduce((s, l) => s + l.width, 0);
      const space = (canvasWidth - totalWidth) / (sorted.length - 1);
      let cx = 0;
      return sorted.map((l) => {
        const result = { ...l, x: cx };
        cx += l.width + space;
        return result;
      });
    }
    case "distribute-v": {
      if (layers.length < 3) return layers;
      const sorted = [...layers].sort((a, b) => a.y - b.y);
      const totalHeight = sorted.reduce((s, l) => s + l.height, 0);
      const space = (canvasHeight - totalHeight) / (sorted.length - 1);
      let cy = 0;
      return sorted.map((l) => {
        const result = { ...l, y: cy };
        cy += l.height + space;
        return result;
      });
    }
    default:
      return layers;
  }
};

// ── First-slice document workspace and SVG renderer ─────────────

export {
  LABEL_DOCUMENT_SCHEMA_VERSION,
  WorkspaceError,
  createLabelWorkspace,
} from "./workspace.js";
export type {
  AddRectangleCommand,
  AddTextCommand,
  CreateDocumentCommand,
  LabelDocument,
  LabelDocumentSize,
  LabelElement,
  LabelRectangleElement,
  LabelTextElement,
  LabelWorkspace,
  MoveElementCommand,
  NewLabelDocument,
  RemoveElementCommand,
  RenameDocumentCommand,
  UpdateTextCommand,
  WorkspaceChange,
  WorkspaceCommand,
} from "./workspace.js";
export { renderLabelDocument } from "./renderer.js";
export type { RenderArtifact } from "./renderer.js";
