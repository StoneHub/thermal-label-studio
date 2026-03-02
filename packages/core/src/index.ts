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
  const widthPx =
    template.size.unit === "mm"
      ? mmToPxAt203Dpi(template.size.width)
      : Math.round(template.size.width);

  const heightPx =
    template.size.unit === "mm"
      ? mmToPxAt203Dpi(template.size.height)
      : Math.round(template.size.height);

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
