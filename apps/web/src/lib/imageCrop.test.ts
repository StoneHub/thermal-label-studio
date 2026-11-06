import { describe, expect, it } from "vitest";
import { cropFromPixels, cropToPixels, drawCrop, FULL_CROP, moveCrop, normalizeCrop, resizeCrop } from "./imageCrop";

describe("source crop geometry", () => {
  it("draws in either direction and bounds selection to the page", () => {
    expect(drawCrop({ x: .8, y: .6 }, { x: .2, y: .1 })).toEqual({ x: .2, y: .1, width: .6000000000000001, height: .5 });
    expect(drawCrop({ x: -1, y: -2 }, { x: 2, y: 2 })).toEqual(FULL_CROP);
  });
  it("keeps a moved selection inside without changing its size", () => {
    expect(moveCrop({ x: .2, y: .2, width: .4, height: .3 }, { x: 1, y: -1 })).toEqual({ x: .6, y: 0, width: .4, height: .3 });
  });
  it("resizes corners independently and prevents inverted or empty crops", () => {
    expect(resizeCrop(FULL_CROP, "se", { x: .7, y: .4 })).toEqual({ x: 0, y: 0, width: .7, height: .4 });
    const next = resizeCrop({ x: .2, y: .2, width: .4, height: .3 }, "nw", { x: 1, y: 1 });
    expect(next.width).toBeCloseTo(.000001); expect(next.height).toBeCloseTo(.000001);
  });
  it("normalizes numeric edits and rejects non-finite dimensions", () => {
    expect(normalizeCrop({ x: NaN, y: Infinity, width: Infinity, height: -1 })).toEqual({ x: 0, y: 0, width: 1, height: .000001 });
  });
  it("rounds pixel boundaries outward and restores existing crops", () => {
    expect(cropToPixels({ x: .123, y: .234, width: .456, height: .321 }, 100, 200)).toEqual({ x: 12, y: 46, width: 46, height: 65, sourceWidth: 100, sourceHeight: 200 });
    expect(cropFromPixels({ x: 100, y: 200, width: 500, height: 1000, sourceWidth: 1000, sourceHeight: 2000 })).toEqual({ x: .1, y: .1, width: .5, height: .5 });
    expect(cropFromPixels()).toEqual(FULL_CROP);
    const narrow = { x: 333, y: 123, width: 5, height: 17, sourceWidth: 1000, sourceHeight: 2000 };
    expect(cropToPixels(cropFromPixels(narrow), 1000, 2000)).toEqual(narrow);
  });
});
