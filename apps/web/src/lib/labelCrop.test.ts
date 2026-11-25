import { describe, expect, it } from "vitest";
import { findDashedLines, locateShippingLabel, type BarcodeHit } from "./labelCrop";

const W = 600, H = 800;
function page() {
  const gray = new Uint8Array(W * H).fill(255);
  const fill = (left: number, top: number, right: number, bottom: number) => {
    for (let y = top; y < bottom; y += 1) gray.fill(0, y * W + left, y * W + right);
  };
  const dashes = (y: number) => { for (let x = 40; x < W - 40; x += 12) fill(x, y, x + 6, y + 1); };
  /** Text-like rows: uneven letters across most of the width. */
  const text = (y: number) => { for (let x = 40, step = 0; x < W - 60; x += 7 + (step++ % 5) * 3) fill(x, y, x + 3 + (step % 3) * 2, y + 12); };
  return { gray, fill, dashes, text };
}
const bar = (left: number, top: number, right: number, bottom: number, turn: BarcodeHit["turn"] = 90): BarcodeHit =>
  ({ box: { left, top, right, bottom }, linear: true, turn });

describe("shipping label crop", () => {
  it("keeps the label between dashed cut lines and turns it upright", () => {
    const { gray, fill, dashes, text } = page();
    text(30); text(60);
    dashes(100);
    fill(100, 130, 500, 132); fill(100, 368, 500, 370); fill(100, 130, 102, 370); fill(498, 130, 500, 370); // label border
    fill(150, 150, 200, 350); fill(300, 160, 380, 340); // two barcodes (bars across, so the label is sideways)
    dashes(400);
    text(420);
    fill(40, 450, 240, 480); // the return slip's own barcode
    const hits = [bar(150, 150, 200, 350), bar(300, 160, 380, 340), bar(40, 450, 240, 480, 0)];
    const found = locateShippingLabel(gray, W, H, hits)!;
    expect(found.rotation).toBe(90);
    expect(found.rotationFromBarcodes).toBe(true);
    expect(found.barcodes).toBe(2);
    // Ink is gathered in 2 px cells, so edges land within a cell of the border plus the margin.
    const margin = Math.round(H * .006);
    const edges = [found.crop.x * W, found.crop.y * H, (found.crop.x + found.crop.width) * W, (found.crop.y + found.crop.height) * H];
    [100 - margin, 130 - margin, 500 + margin, 370 + margin].forEach((expected, index) => expect(Math.abs(edges[index] - expected)).toBeLessThanOrEqual(2));
  });

  it("finds dashed cut lines but not lines of text", () => {
    const { gray, dashes, text } = page();
    text(30); dashes(100); text(200);
    expect(findDashedLines(gray, W, H, "rows")).toEqual([100]);
    expect(findDashedLines(gray, W, H, "columns")).toEqual([]);
  });

  it("without separators takes the ink block around the bar codes, not text far from it", () => {
    const { gray, fill, text } = page();
    text(30);
    fill(200, 300, 260, 500); fill(300, 300, 330, 500); fill(210, 520, 320, 530);
    const found = locateShippingLabel(gray, W, H, [bar(200, 300, 260, 500, 0)])!;
    expect(found.rotation).toBe(0);
    expect(found.crop.y * H).toBeGreaterThan(280);
    expect((found.crop.y + found.crop.height) * H).toBeLessThan(545);
    expect(found.crop.x * W).toBeGreaterThan(190);
  });

  it("guesses a quarter turn from a landscape label when the bar codes give no direction", () => {
    const { gray, fill } = page();
    fill(100, 300, 500, 450);
    const found = locateShippingLabel(gray, W, H, [bar(120, 320, 480, 430, null)])!;
    expect(found.rotation).toBe(90);
    expect(found.rotationFromBarcodes).toBe(false);
  });

  it("needs a bar code: a QR code alone is not a shipping label", () => {
    const { gray, fill } = page();
    fill(100, 100, 200, 200);
    expect(locateShippingLabel(gray, W, H, [{ box: { left: 100, top: 100, right: 200, bottom: 200 }, linear: false, turn: 0 }])).toBeNull();
  });
});
