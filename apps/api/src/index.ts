import express from "express";
import cors from "cors";
import { PNG } from "pngjs";
import {
  applyFieldOverrides,
  extractPlaceholders,
  inferTemplateCategory,
  toPixels,
  type LabelCategory,
  type LabelTemplate
} from "@tls/core";
import { starterTemplates } from "@tls/templates";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const templateMap = new Map(starterTemplates.map((t) => [t.id, t]));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "@tls/api" });
});

app.get("/templates", (req, res) => {
  const category = (req.query.category as LabelCategory | "all" | undefined) ?? "all";
  const list = starterTemplates.filter((template) =>
    category === "all" ? true : inferTemplateCategory(template) === category
  );

  res.json({
    templates: list.map((template) => ({
      ...template,
      category: inferTemplateCategory(template),
      placeholders: extractPlaceholders(template)
    }))
  });
});

app.post("/templates/:id/apply", (req, res) => {
  const template = templateMap.get(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  const overrides = (req.body?.overrides ?? {}) as Record<string, string>;
  const applied = applyFieldOverrides(template, overrides);
  return res.json({ template: applied });
});

app.post("/templates/:id/render", (req, res) => {
  const template = templateMap.get(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  const body = req.body ?? {};
  const overrides = (body.overrides ?? {}) as Record<string, string>;
  const imageTransforms = (body.imageTransforms ?? {}) as Record<
    string,
    { x: number; y: number; scale: number }
  >;

  const rendered = applyFieldOverrides(template, overrides);
  const png = renderTemplatePng(rendered, imageTransforms);
  const pngBuffer = PNG.sync.write(png);

  res.json({
    width: png.width,
    height: png.height,
    pngBase64: pngBuffer.toString("base64")
  });
});

const renderTemplatePng = (
  template: LabelTemplate,
  imageTransforms: Record<string, { x: number; y: number; scale: number }>
): PNG => {
  const width = toPixels(template.size.width, template.size.unit);
  const height = toPixels(template.size.height, template.size.unit);
  const png = new PNG({ width, height });

  fillRect(png, 0, 0, width, height, [255, 255, 255, 255]);

  for (const layer of template.layers) {
    if (layer.type === "text") {
      const blockW = Math.min(width - layer.x - 8, Math.max(120, layer.text.length * 10));
      const blockH = Math.max(18, Math.round(layer.fontSize * 1.1));
      fillRect(png, layer.x, layer.y, blockW, blockH, [25, 25, 25, 255]);
    } else {
      const t = imageTransforms[layer.id] ?? { x: 0, y: 0, scale: 1 };
      const viewX = layer.x + t.x;
      const viewY = layer.y + t.y;
      const viewW = Math.max(20, Math.round(layer.width * (t.scale || 1)));
      const viewH = Math.max(20, Math.round(layer.height * (t.scale || 1)));
      fillRect(png, viewX, viewY, viewW, viewH, [150, 150, 150, 255]);
      strokeRect(png, layer.x, layer.y, layer.width, layer.height, [20, 20, 20, 255]);
    }
  }

  return png;
};

const fillRect = (
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number, number]
) => {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(png.width, Math.ceil(x + w));
  const y1 = Math.min(png.height, Math.ceil(y + h));

  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const idx = (png.width * yy + xx) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }
};

const strokeRect = (
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number, number]
) => {
  fillRect(png, x, y, w, 2, color);
  fillRect(png, x, y + h - 2, w, 2, color);
  fillRect(png, x, y, 2, h, color);
  fillRect(png, x + w - 2, y, 2, h, color);
};

const port = Number(process.env.PORT ?? 3001);
app.listen(port, "0.0.0.0", () => {
  console.log(`@tls/api listening on http://0.0.0.0:${port}`);
});
