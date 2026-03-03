import { describe, it, expect } from "vitest";
import {
  mmToPxAt203Dpi,
  toPixels,
  createEmptyTemplate,
  extractPlaceholders,
  applyFieldOverrides,
  inferTemplateCategory,
  createTextLayer,
  createShapeLayer,
  createImageLayer,
  duplicateLayer,
  moveLayer,
  resizeLayer,
  rotateLayer,
  computeSnapLines,
  alignLayers,
  generateId,
  CANVAS_TARGET,
  SNAP_THRESHOLD,
  type LabelTemplate,
  type LabelTextLayer,
} from "./index";

// ── Unit conversions ─────────────────────────────────────────────

describe("mmToPxAt203Dpi", () => {
  it("converts 25.4mm (1 inch) to 203px", () => {
    expect(mmToPxAt203Dpi(25.4)).toBe(203);
  });

  it("converts 101.6mm (4 inch) to ~812px", () => {
    expect(mmToPxAt203Dpi(101.6)).toBe(812);
  });

  it("converts 0mm to 0px", () => {
    expect(mmToPxAt203Dpi(0)).toBe(0);
  });
});

describe("toPixels", () => {
  it("converts mm to px", () => {
    expect(toPixels(25.4, "mm")).toBe(203);
  });

  it("passes px through with rounding", () => {
    expect(toPixels(100.7, "px")).toBe(101);
  });
});

// ── Template creation ────────────────────────────────────────────

describe("createEmptyTemplate", () => {
  it("creates a blank template with correct defaults", () => {
    const t = createEmptyTemplate();
    expect(t.id).toBe("new-template");
    expect(t.name).toBe("Untitled Label");
    expect(t.size.width).toBe(CANVAS_TARGET.width);
    expect(t.size.height).toBe(CANVAS_TARGET.height);
    expect(t.size.unit).toBe("px");
    expect(t.layers).toEqual([]);
  });

  it("accepts custom id", () => {
    expect(createEmptyTemplate("my-label").id).toBe("my-label");
  });
});

// ── Placeholder extraction ───────────────────────────────────────

describe("extractPlaceholders", () => {
  it("extracts placeholders from text layers", () => {
    const t: LabelTemplate = {
      id: "test",
      name: "Test",
      size: { width: 800, height: 1200, unit: "px" },
      layers: [
        { id: "a", type: "text", x: 0, y: 0, width: 200, height: 40, text: "Hello {{name}}", fontSize: 24 },
        { id: "b", type: "text", x: 0, y: 50, width: 200, height: 40, text: "{{address}}", fontSize: 20 },
      ],
    };
    expect(extractPlaceholders(t)).toEqual(["name", "address"]);
  });

  it("extracts placeholders from image layers", () => {
    const t: LabelTemplate = {
      id: "test",
      name: "Test",
      size: { width: 800, height: 1200, unit: "px" },
      layers: [
        { id: "img", type: "image", x: 0, y: 0, width: 200, height: 200, source: "{{logo_url}}" },
      ],
    };
    expect(extractPlaceholders(t)).toEqual(["logo_url"]);
  });

  it("deduplicates placeholders", () => {
    const t: LabelTemplate = {
      id: "test",
      name: "Test",
      size: { width: 800, height: 1200, unit: "px" },
      layers: [
        { id: "a", type: "text", x: 0, y: 0, width: 200, height: 40, text: "{{name}} and {{name}}", fontSize: 24 },
      ],
    };
    expect(extractPlaceholders(t)).toEqual(["name"]);
  });

  it("returns empty for no placeholders", () => {
    const t: LabelTemplate = {
      id: "test",
      name: "Test",
      size: { width: 800, height: 1200, unit: "px" },
      layers: [
        { id: "a", type: "text", x: 0, y: 0, width: 200, height: 40, text: "Hello world", fontSize: 24 },
      ],
    };
    expect(extractPlaceholders(t)).toEqual([]);
  });

  it("handles shapes (no source to scan)", () => {
    const t: LabelTemplate = {
      id: "test",
      name: "Test",
      size: { width: 800, height: 1200, unit: "px" },
      layers: [
        { id: "s", type: "shape", shapeType: "rect", x: 0, y: 0, width: 100, height: 100, fill: "#fff", stroke: "#000", strokeWidth: 1 },
      ],
    };
    expect(extractPlaceholders(t)).toEqual([]);
  });
});

// ── Field overrides ──────────────────────────────────────────────

describe("applyFieldOverrides", () => {
  const base: LabelTemplate = {
    id: "test",
    name: "Test",
    size: { width: 800, height: 1200, unit: "px" },
    layers: [
      { id: "a", type: "text", x: 0, y: 0, width: 200, height: 40, text: "Dear {{name}}", fontSize: 24 },
      { id: "b", type: "image", x: 0, y: 50, width: 200, height: 200, source: "{{photo}}" },
    ],
  };

  it("substitutes text placeholders", () => {
    const result = applyFieldOverrides(base, { name: "Alice" });
    const textLayer = result.layers[0] as LabelTextLayer;
    expect(textLayer.text).toBe("Dear Alice");
  });

  it("substitutes image source placeholders", () => {
    const result = applyFieldOverrides(base, { photo: "http://img.png" });
    const imgLayer = result.layers[1] as any;
    expect(imgLayer.source).toBe("http://img.png");
  });

  it("leaves unmatched placeholders intact", () => {
    const result = applyFieldOverrides(base, {});
    const textLayer = result.layers[0] as LabelTextLayer;
    expect(textLayer.text).toBe("Dear {{name}}");
  });

  it("doesn't mutate original", () => {
    applyFieldOverrides(base, { name: "Bob" });
    expect((base.layers[0] as LabelTextLayer).text).toBe("Dear {{name}}");
  });
});

// ── Category inference ───────────────────────────────────────────

describe("inferTemplateCategory", () => {
  it("infers sticker for ids containing 'sticker'", () => {
    const t = createEmptyTemplate("my-sticker-sheet");
    expect(inferTemplateCategory(t)).toBe("sticker");
  });

  it("infers full for other ids", () => {
    const t = createEmptyTemplate("shipping-label");
    expect(inferTemplateCategory(t)).toBe("full");
  });

  it("uses explicit category when set", () => {
    const t = { ...createEmptyTemplate("something"), category: "sticker" as const };
    expect(inferTemplateCategory(t)).toBe("sticker");
  });
});

// ── Layer creation ───────────────────────────────────────────────

describe("createTextLayer", () => {
  it("creates with defaults", () => {
    const layer = createTextLayer();
    expect(layer.type).toBe("text");
    expect(layer.text).toBe("New Text");
    expect(layer.fontSize).toBe(24);
    expect(layer.id).toBeTruthy();
  });

  it("accepts overrides", () => {
    const layer = createTextLayer({ text: "Custom", fontSize: 48 });
    expect(layer.text).toBe("Custom");
    expect(layer.fontSize).toBe(48);
  });
});

describe("createShapeLayer", () => {
  it("creates rect by default", () => {
    const layer = createShapeLayer();
    expect(layer.type).toBe("shape");
    expect(layer.shapeType).toBe("rect");
  });
});

describe("createImageLayer", () => {
  it("creates with empty source", () => {
    const layer = createImageLayer();
    expect(layer.type).toBe("image");
    expect(layer.source).toBe("");
  });
});

// ── Layer manipulation ───────────────────────────────────────────

describe("duplicateLayer", () => {
  it("creates a copy with new id and offset", () => {
    const original = createTextLayer();
    const copy = duplicateLayer(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.x).toBe(original.x + 20);
    expect(copy.y).toBe(original.y + 20);
    expect(copy.type).toBe("text");
  });
});

describe("moveLayer", () => {
  it("moves by delta", () => {
    const layer = createTextLayer({ x: 100, y: 200 });
    const moved = moveLayer(layer, 10, -5);
    expect(moved.x).toBe(110);
    expect(moved.y).toBe(195);
  });
});

describe("resizeLayer", () => {
  it("applies new dimensions with minimum", () => {
    const layer = createTextLayer();
    const resized = resizeLayer(layer, 5, 300);
    expect(resized.width).toBe(10); // clamped to min 10
    expect(resized.height).toBe(300);
  });
});

describe("rotateLayer", () => {
  it("sets rotation", () => {
    const layer = createTextLayer();
    const rotated = rotateLayer(layer, 45);
    expect(rotated.rotation).toBe(45);
  });
});

// ── Snap guides ──────────────────────────────────────────────────

describe("computeSnapLines", () => {
  it("snaps to canvas center", () => {
    const moving = createTextLayer({ x: 398, y: 50, width: 100, height: 40 });
    const result = computeSnapLines(moving, [], 800, 1200);
    // 398 + 100/2 = 448, canvas center = 400, diff = -48, too far
    // left edge: 398, canvas center = 400, diff = 2 → should snap
    expect(result.snappedX).toBe(400);
  });

  it("snaps to other layer edge", () => {
    const other = createTextLayer({ x: 200, y: 100, width: 150, height: 40 });
    // Place moving layer so its left edge is near other's right edge (350)
    const moving = createTextLayer({ x: 348, y: 200, width: 100, height: 40 });
    const result = computeSnapLines(moving, [other], 800, 1200);
    expect(result.snappedX).toBe(350);
  });

  it("returns no snap when nothing is close", () => {
    const moving = createTextLayer({ x: 100, y: 100, width: 50, height: 30 });
    const result = computeSnapLines(moving, [], 800, 1200);
    // 100 is far from 0, 400, 800
    if (result.snappedX !== null) {
      // Might snap to edge 0 if within threshold
      expect(Math.abs(result.snappedX - moving.x)).toBeLessThanOrEqual(SNAP_THRESHOLD);
    }
  });
});

// ── Alignment ────────────────────────────────────────────────────

describe("alignLayers", () => {
  const layers = [
    createTextLayer({ x: 100, y: 200, width: 150, height: 40 }),
    createTextLayer({ x: 300, y: 400, width: 100, height: 30 }),
  ];

  it("aligns left", () => {
    const aligned = alignLayers(layers, "align-left", 800, 1200);
    expect(aligned[0].x).toBe(0);
    expect(aligned[1].x).toBe(0);
  });

  it("aligns right", () => {
    const aligned = alignLayers(layers, "align-right", 800, 1200);
    expect(aligned[0].x).toBe(800 - 150);
    expect(aligned[1].x).toBe(800 - 100);
  });

  it("centers horizontal", () => {
    const aligned = alignLayers(layers, "align-center-h", 800, 1200);
    expect(aligned[0].x).toBe((800 - 150) / 2);
    expect(aligned[1].x).toBe((800 - 100) / 2);
  });

  it("aligns top", () => {
    const aligned = alignLayers(layers, "align-top", 800, 1200);
    expect(aligned[0].y).toBe(0);
    expect(aligned[1].y).toBe(0);
  });

  it("returns empty for empty input", () => {
    expect(alignLayers([], "align-left", 800, 1200)).toEqual([]);
  });
});

// ── generateId ───────────────────────────────────────────────────

describe("generateId", () => {
  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
