import { describe, expect, it } from "vitest";
import { classifyArtworkFile, fitArtworkWithin } from "./artworkImport";

describe("classifyArtworkFile", () => {
  it.each([
    ["photo.png", "image/png", "image"],
    ["photo.JPG", "", "image"],
    ["clipboard.webp", "image/webp", "image"],
    ["vector.svg", "image/svg+xml", "image"],
    ["document.pdf", "application/pdf", "pdf"],
    ["clipboard", "application/pdf", "pdf"],
  ])("classifies %s", (name, type, expected) => {
    expect(classifyArtworkFile({ name, type })).toBe(expected);
  });

  it("rejects formats outside the browser import set", () => {
    expect(classifyArtworkFile({ name: "notes.txt", type: "text/plain" })).toBe("unsupported");
    expect(classifyArtworkFile({ name: "drawing.bmp", type: "image/bmp" })).toBe("unsupported");
    expect(classifyArtworkFile({ name: "drawing.png", type: "image/bmp" })).toBe("unsupported");
  });
});

describe("fitArtworkWithin", () => {
  it("fits a wide image inside a portrait label and centers it", () => {
    expect(fitArtworkWithin({ width: 1600, height: 900 }, { width: 800, height: 1200 }, 40)).toEqual({
      x: 40,
      y: 397.5,
      width: 720,
      height: 405,
    });
  });

  it("supports asymmetric margins", () => {
    expect(
      fitArtworkWithin(
        { width: 100, height: 100 },
        { width: 500, height: 300 },
        { top: 10, right: 20, bottom: 30, left: 40 }
      )
    ).toEqual({ x: 130, y: 10, width: 260, height: 260 });
  });

});
