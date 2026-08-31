import { describe, expect, it } from "vitest";
import { packMonochromePbm } from "./printIntent";

function pixel(r: number, g: number, b: number, a = 255): number[] {
  return [r, g, b, a];
}

describe("packMonochromePbm", () => {
  it("packs one-bit rows with a stable black threshold", () => {
    const rgba = new Uint8ClampedArray([
      ...pixel(0, 0, 0),
      ...pixel(255, 255, 255),
      ...pixel(160, 160, 160),
      ...pixel(168, 168, 168),
      ...pixel(255, 0, 0),
      ...pixel(0, 255, 0),
      ...pixel(0, 0, 255),
      ...pixel(0, 0, 0, 0),
    ]);

    const packed = packMonochromePbm(rgba, 8, 1);
    const header = new TextEncoder().encode("P4\n8 1\n");

    expect(Array.from(packed.bytes.slice(0, header.length))).toEqual(Array.from(header));
    expect(packed.bytes.at(-1)).toBe(0b10101110);
    expect(packed.blackPixelCount).toBe(5);
  });

  it("rejects mismatched pixel buffers", () => {
    expect(() => packMonochromePbm(new Uint8ClampedArray(4), 2, 1)).toThrow(/does not match/);
  });
});
