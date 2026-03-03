import express from "express";
import cors from "cors";
import { PNG } from "pngjs";
import { z } from "zod";
import {
  applyFieldOverrides,
  extractPlaceholders,
  inferTemplateCategory,
  toPixels,
  CANVAS_TARGET,
  type LabelCategory,
  type LabelTemplate,
} from "@tls/core";
import { starterTemplates } from "@tls/templates";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ── Template store (in-memory + user-saved) ──────────────────────

const templateStore = new Map<string, LabelTemplate>(
  starterTemplates.map((t) => [t.id, t])
);

// ── Zod schemas ──────────────────────────────────────────────────

const OverridesSchema = z.record(z.string(), z.string()).optional().default({});

const RenderRequestSchema = z.object({
  overrides: OverridesSchema,
  imageTransforms: z
    .record(z.string(), z.object({ x: z.number(), y: z.number(), scale: z.number() }))
    .optional()
    .default({}),
});

const TemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["full", "sticker"]).optional(),
  tags: z.array(z.string()).optional(),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(["px", "mm"]),
  }),
  layers: z.array(z.any()),
  fields: z.record(z.string(), z.any()).optional(),
});

const PrintJobSchema = z.object({
  templateId: z.string().min(1),
  overrides: OverridesSchema,
  copies: z.number().int().min(1).max(20).optional().default(1),
});

// ── Health ───────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "@tls/api", version: "1.0.0" });
});

// ── Templates CRUD ───────────────────────────────────────────────

// List templates
app.get("/templates", (req, res) => {
  const category = (req.query.category as LabelCategory | "all" | undefined) ?? "all";
  const list = [...templateStore.values()].filter((template) =>
    category === "all" ? true : inferTemplateCategory(template) === category
  );

  res.json({
    templates: list.map((template) => ({
      ...template,
      category: inferTemplateCategory(template),
      placeholders: extractPlaceholders(template),
    })),
  });
});

// Get single template
app.get("/templates/:id", (req, res) => {
  const template = templateStore.get(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });

  return res.json({
    template: {
      ...template,
      category: inferTemplateCategory(template),
      placeholders: extractPlaceholders(template),
    },
  });
});

// Get template schema (for automation)
app.get("/templates/:id/schema", (req, res) => {
  const template = templateStore.get(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const placeholders = extractPlaceholders(template);
  const fields: Record<string, { type: string; required: boolean; default?: string }> = {};

  for (const key of placeholders) {
    // Infer if it's an image field
    const isImage = template.layers.some(
      (l) => l.type === "image" && l.source.includes(`{{${key}}}`)
    );
    fields[key] = {
      type: isImage ? "image_url" : "text",
      required: false,
    };
  }

  // Also include defined fields from template
  if (template.fields) {
    for (const [key, field] of Object.entries(template.fields)) {
      fields[key] = {
        type: field.type,
        required: field.required ?? false,
        default: field.default,
      };
    }
  }

  return res.json({
    templateId: template.id,
    name: template.name,
    category: inferTemplateCategory(template),
    canvasSize: {
      width: toPixels(template.size.width, template.size.unit),
      height: toPixels(template.size.height, template.size.unit),
    },
    fields,
  });
});

// Save / update template
app.post("/templates", (req, res) => {
  try {
    const body = req.body?.template ?? req.body;
    const template = TemplateSchema.parse(body) as LabelTemplate;
    templateStore.set(template.id, template);
    return res.json({ ok: true, id: template.id });
  } catch (err) {
    return res.status(400).json({
      error: "Invalid template",
      details: err instanceof z.ZodError ? err.errors : String(err),
    });
  }
});

// Delete template
app.delete("/templates/:id", (req, res) => {
  const existed = templateStore.delete(req.params.id);
  return res.json({ ok: true, deleted: existed });
});

// ── Template apply / render ──────────────────────────────────────

// Apply field overrides (returns updated template JSON)
app.post("/templates/:id/apply", (req, res) => {
  const template = templateStore.get(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const overrides = (req.body?.overrides ?? {}) as Record<string, string>;
  const applied = applyFieldOverrides(template, overrides);
  return res.json({ template: applied });
});

// Update specific placeholder fields
app.patch("/templates/:id/fields", (req, res) => {
  const template = templateStore.get(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const fieldUpdates = (req.body?.fields ?? {}) as Record<string, string>;
  const applied = applyFieldOverrides(template, fieldUpdates);
  templateStore.set(template.id, applied);
  return res.json({ ok: true, template: applied });
});

// Render template to PNG
app.post("/templates/:id/render", (req, res) => {
  const template = templateStore.get(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });

  try {
    const { overrides, imageTransforms } = RenderRequestSchema.parse(req.body ?? {});
    const rendered = applyFieldOverrides(template, overrides);
    const png = renderTemplatePng(rendered, imageTransforms);
    const pngBuffer = PNG.sync.write(png);

    res.json({
      ok: true,
      width: png.width,
      height: png.height,
      format: "png",
      pngBase64: pngBuffer.toString("base64"),
    });
  } catch (err) {
    res.status(400).json({
      error: "Render failed",
      details: err instanceof z.ZodError ? err.errors : String(err),
    });
  }
});

// Render from client canvas (accepts a PNG data URL, resizes to thermal)
app.post("/render/from-canvas", async (req, res) => {
  const { pngDataUrl } = req.body ?? {};
  if (!pngDataUrl || typeof pngDataUrl !== "string") {
    return res.status(400).json({ error: "pngDataUrl required" });
  }

  try {
    // Strip data URL prefix
    const base64 = pngDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    // Try sharp if available, otherwise return as-is
    try {
      const sharp = await import("sharp");
      const resized = await sharp
        .default(buffer)
        .resize(CANVAS_TARGET.width, CANVAS_TARGET.height, { fit: "contain", background: "#ffffff" })
        .png()
        .toBuffer();

      return res.json({
        ok: true,
        width: CANVAS_TARGET.width,
        height: CANVAS_TARGET.height,
        format: "png",
        pngBase64: resized.toString("base64"),
      });
    } catch {
      // Sharp not available, return original
      return res.json({
        ok: true,
        width: CANVAS_TARGET.width,
        height: CANVAS_TARGET.height,
        format: "png",
        pngBase64: base64,
        note: "sharp not available, returned original resolution",
      });
    }
  } catch (err) {
    return res.status(500).json({ error: "Processing failed", details: String(err) });
  }
});

// ── Print jobs ───────────────────────────────────────────────────

interface PrintJob {
  id: string;
  templateId: string;
  overrides: Record<string, string>;
  copies: number;
  status: "queued" | "rendering" | "printing" | "done" | "error";
  createdAt: string;
  error?: string;
}

const printJobs = new Map<string, PrintJob>();
let jobCounter = 0;

// Queue a print job
app.post("/print/jobs", (req, res) => {
  try {
    const { templateId, overrides, copies } = PrintJobSchema.parse(req.body);
    const template = templateStore.get(templateId);
    if (!template) return res.status(404).json({ error: "Template not found" });

    const jobId = `job_${++jobCounter}_${Date.now().toString(36)}`;
    const job: PrintJob = {
      id: jobId,
      templateId,
      overrides,
      copies,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    printJobs.set(jobId, job);

    // Process job async (simulate for now — real integration hooks into thermal_print.sh)
    processJob(job).catch((err) => {
      job.status = "error";
      job.error = String(err);
    });

    return res.json({
      ok: true,
      jobId: job.id,
      status: job.status,
    });
  } catch (err) {
    return res.status(400).json({
      error: "Invalid print request",
      details: err instanceof z.ZodError ? err.errors : String(err),
    });
  }
});

// Get job status
app.get("/print/jobs/:id", (req, res) => {
  const job = printJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json({ job });
});

// List recent jobs
app.get("/print/jobs", (_req, res) => {
  const jobs = [...printJobs.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
  return res.json({ jobs });
});

async function processJob(job: PrintJob): Promise<void> {
  job.status = "rendering";
  const template = templateStore.get(job.templateId);
  if (!template) throw new Error("Template not found");

  const rendered = applyFieldOverrides(template, job.overrides);
  const png = renderTemplatePng(rendered, {});
  const pngBuffer = PNG.sync.write(png);

  job.status = "printing";

  // Real print integration point:
  // This is where you'd call thermal_print.sh or send to a USB printer.
  // For now we just simulate a delay and mark done.
  // The contract is:
  //   thermal_print.sh --input <path-to-png> --copies <n>
  await new Promise((resolve) => setTimeout(resolve, 500));

  job.status = "done";
}

// ── Render helpers ───────────────────────────────────────────────

const renderTemplatePng = (
  template: LabelTemplate,
  imageTransforms: Record<string, { x: number; y: number; scale: number }>
): PNG => {
  const width = toPixels(template.size.width, template.size.unit);
  const height = toPixels(template.size.height, template.size.unit);
  const png = new PNG({ width, height });

  fillRect(png, 0, 0, width, height, [255, 255, 255, 255]);

  for (const layer of template.layers) {
    if ((layer as any).visible === false) continue;

    if (layer.type === "text") {
      // Improved text rendering — filled block with contrasting color
      const fill = parseColor(layer.fill ?? "#000000");
      const blockW = layer.width ?? Math.min(width - layer.x - 8, Math.max(120, layer.text.length * 10));
      const blockH = layer.height ?? Math.max(18, Math.round(layer.fontSize * 1.1));
      fillRect(png, layer.x, layer.y, blockW, blockH, fill);
    } else if (layer.type === "shape") {
      const fill = parseColor(layer.fill ?? "#e0e0e0");
      const stroke = parseColor(layer.stroke ?? "#333333");
      fillRect(png, layer.x, layer.y, layer.width, layer.height, fill);
      if (layer.strokeWidth && layer.strokeWidth > 0) {
        strokeRect(png, layer.x, layer.y, layer.width, layer.height, stroke, layer.strokeWidth);
      }
    } else if (layer.type === "image") {
      const t = imageTransforms[layer.id] ?? { x: 0, y: 0, scale: 1 };
      const viewX = layer.x + t.x;
      const viewY = layer.y + t.y;
      const viewW = Math.max(20, Math.round(layer.width * (t.scale || 1)));
      const viewH = Math.max(20, Math.round(layer.height * (t.scale || 1)));
      fillRect(png, viewX, viewY, viewW, viewH, [200, 200, 200, 255]);
      strokeRect(png, layer.x, layer.y, layer.width, layer.height, [100, 100, 100, 255], 2);
    }
  }

  return png;
};

function parseColor(hex: string): [number, number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      255,
    ];
  }
  if (clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ];
  }
  return [128, 128, 128, 255];
}

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
  color: [number, number, number, number],
  strokeWidth = 2
) => {
  fillRect(png, x, y, w, strokeWidth, color);
  fillRect(png, x, y + h - strokeWidth, w, strokeWidth, color);
  fillRect(png, x, y, strokeWidth, h, color);
  fillRect(png, x + w - strokeWidth, y, strokeWidth, h, color);
};

// ── Start server ─────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3001);
app.listen(port, "0.0.0.0", () => {
  console.log(`@tls/api v1.0.0 listening on http://0.0.0.0:${port}`);
  console.log(`Templates loaded: ${templateStore.size}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /health`);
  console.log(`  GET  /templates`);
  console.log(`  GET  /templates/:id`);
  console.log(`  GET  /templates/:id/schema`);
  console.log(`  POST /templates`);
  console.log(`  POST /templates/:id/apply`);
  console.log(`  POST /templates/:id/render`);
  console.log(`  PATCH /templates/:id/fields`);
  console.log(`  DELETE /templates/:id`);
  console.log(`  POST /render/from-canvas`);
  console.log(`  POST /print/jobs`);
  console.log(`  GET  /print/jobs`);
  console.log(`  GET  /print/jobs/:id`);
});
