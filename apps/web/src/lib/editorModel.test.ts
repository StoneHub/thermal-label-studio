import { describe, expect, it } from "vitest";
import { renderLabelDocument, type LabelDocument, type LabelImageElement } from "@tls/core";
import {
  initialDocument,
  resizeImageFromCorner,
  withElementGeometry,
} from "./editorModel";

const image: LabelImageElement = {
  id: "photo",
  type: "image",
  x: 100,
  y: 200,
  width: 200,
  height: 100,
  source: "data:image/png;base64,AAAA",
  rotation: 90,
};

const document: LabelDocument = {
  schemaVersion: 1,
  id: "label",
  name: "Label",
  revision: 1,
  size: { width: 800, height: 1200 },
  elements: [image],
};

describe("editor model", () => {
  it("starts with a blank untitled label", () => {
    expect(initialDocument.name).toBe("Untitled label");
    expect(initialDocument.elements).toEqual([]);
  });

  it("previews a horizontal drag in document coordinates after rotation", () => {
    const preview = withElementGeometry(document, image.id, { x: image.x + 60, y: image.y });
    const source = renderLabelDocument(preview).source;

    expect(preview.elements[0]).toMatchObject({ x: 160, y: 200, rotation: 90 });
    expect(source).toContain('<g transform="rotate(90 260 250)">');
    expect(source).toContain('x="160" y="200"');
  });

  it("scales a rotated image from a corner while preserving its ratio", () => {
    const resized = resizeImageFromCorner(image, { x: 1, y: 1 }, { x: 100, y: 450 });

    expect(resized).toEqual({ x: 25, y: 225, width: 300, height: 150 });
  });

  it("scales an unrotated image from its bottom-right corner", () => {
    const resized = resizeImageFromCorner({ ...image, rotation: 0 }, { x: 1, y: 1 }, { x: 400, y: 350 });

    expect(resized).toEqual({ x: 100, y: 200, width: 300, height: 150 });
  });
});
