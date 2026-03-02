export type LabelUnit = "px" | "mm";

export interface LabelSize {
  width: number;
  height: number;
  unit: LabelUnit;
}

export interface LabelTextLayer {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export interface LabelImageLayer {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  source: string;
}

export type LabelLayer = LabelTextLayer | LabelImageLayer;

export interface LabelTemplate {
  id: string;
  name: string;
  size: LabelSize;
  layers: LabelLayer[];
}

export interface RenderResult {
  ok: boolean;
  format: "png" | "tspl";
  widthPx: number;
  heightPx: number;
  notes: string[];
}

export type LabelCategory = "full" | "sticker";

const MM_PER_INCH = 25.4;
const THERMAL_DPI = 203;

export const mmToPxAt203Dpi = (mm: number): number =>
  Math.round((mm / MM_PER_INCH) * THERMAL_DPI);

export const createEmptyTemplate = (id = "new-template"): LabelTemplate => ({
  id,
  name: "Untitled Label",
  size: { width: 101.6, height: 152.4, unit: "mm" },
  layers: []
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
      "Hook real canvas/TSPL renderer in packages/core."
    ]
  };
};

export const toPixels = (value: number, unit: LabelUnit): number =>
  unit === "mm" ? mmToPxAt203Dpi(value) : Math.round(value);

export const extractPlaceholders = (template: LabelTemplate): string[] => {
  const set = new Set<string>();
  for (const layer of template.layers) {
    const source = layer.type === "text" ? layer.text : layer.source;
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
      if (layer.type === "text") {
        return { ...layer, text: replace(layer.text) };
      }
      return { ...layer, source: replace(layer.source) };
    })
  };
};

export const inferTemplateCategory = (template: LabelTemplate): LabelCategory =>
  template.id.includes("sticker") ? "sticker" : "full";
