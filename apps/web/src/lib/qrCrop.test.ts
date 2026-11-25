import { describe, expect, it } from "vitest";
import { qrCropFromCorners } from "./qrCrop";

describe("QR crop", () => {
  // A version 2 symbol is 25 modules wide; at 4 source pixels per module it is 100 px.
  const corners = { topLeft: { x: 400, y: 1000 }, topRight: { x: 500, y: 1000 },
    bottomRight: { x: 500, y: 1100 }, bottomLeft: { x: 400, y: 1100 } };

  it("keeps the four-module quiet zone around the symbol", () => {
    const { crop, modulePixels } = qrCropFromCorners(corners, 2, 1000, 2000);
    expect(modulePixels).toBe(4);
    expect(crop.x * 1000).toBeCloseTo(384);
    expect(crop.y * 2000).toBeCloseTo(984);
    expect(crop.width * 1000).toBeCloseTo(132);
    expect(crop.height * 2000).toBeCloseTo(132);
  });

  it("clamps the quiet zone at the image edge", () => {
    const edge = { topLeft: { x: 0, y: 0 }, topRight: { x: 100, y: 0 },
      bottomRight: { x: 100, y: 100 }, bottomLeft: { x: 0, y: 100 } };
    const { crop } = qrCropFromCorners(edge, 2, 1000, 1000);
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(0);
    expect(crop.width * 1000).toBeCloseTo(116);
  });

  it("bounds a rotated symbol with an axis-aligned box", () => {
    const rotated = { topLeft: { x: 450, y: 950 }, topRight: { x: 550, y: 1050 },
      bottomRight: { x: 450, y: 1150 }, bottomLeft: { x: 350, y: 1050 } };
    const { crop } = qrCropFromCorners(rotated, 2, 1000, 2000);
    expect(crop.x * 1000).toBeLessThan(350);
    expect((crop.x + crop.width) * 1000).toBeGreaterThan(550);
  });
});
