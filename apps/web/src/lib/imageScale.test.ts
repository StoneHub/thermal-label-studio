import { describe, expect, it } from "vitest";
import type { LabelImageElement } from "@tls/core";
import { frameImageToLabel, imageScalePercent, printedCropSize, scaleImageToPercent } from "./editorModel";

const label = { width: 800, height: 1200 };
const qr: LabelImageElement = {
  id: "qr", type: "image", source: "data:image/png;base64,AAAA", fit: "contain",
  crop: { x: 100, y: 200, width: 300, height: 300, sourceWidth: 1000, sourceHeight: 2000 },
  ...frameImageToLabel({ id: "qr", type: "image", source: "", x: 0, y: 0, width: 1, height: 1 }, label),
};

describe("image scale", () => {
  it("reports a framed image as 100%", () => {
    expect(imageScalePercent(qr, label)).toBe(100);
  });

  it("scales about the centre and stays on the label", () => {
    const half = scaleImageToPercent(qr, label, 50);
    expect(half).toEqual({ x: 200, y: 300, width: 400, height: 600 });
    expect(imageScalePercent({ ...qr, ...half }, label)).toBe(50);
  });

  it("clamps to the label and to a visible minimum", () => {
    expect(scaleImageToPercent(qr, label, 400)).toEqual({ x: 0, y: 0, width: 800, height: 1200 });
    expect(scaleImageToPercent(qr, label, 0).width).toBe(80);
  });

  it("keeps an off-centre image inside the label when it grows", () => {
    const small = { ...qr, x: 600, y: 0, width: 200, height: 300 };
    const grown = scaleImageToPercent(small, label, 80);
    expect(grown.x + grown.width).toBeLessThanOrEqual(800);
    expect(grown.y).toBeGreaterThanOrEqual(0);
  });

  it("measures a square crop framed on the 4x6 label at nearly 4 inches", () => {
    const size = printedCropSize(qr)!;
    expect(size.width).toBeCloseTo(800 / 203.2, 5);
    expect(size.height).toBeCloseTo(size.width, 5);
    expect(printedCropSize({ ...qr, crop: undefined })).toBeNull();
  });
});
