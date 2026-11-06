import { describe, expect, it } from "vitest";
import { createLabelWorkspace, renderLabelDocument, type LabelImageCrop, type LabelImageElement } from "./index";

const crop: LabelImageCrop = { x: 100, y: 200, width: 400, height: 200, sourceWidth: 800, sourceHeight: 1000 };
const source = "data:image/png;base64,AAAA";
const image: LabelImageElement = { id: "photo", type: "image", x: 10, y: 20, width: 100, height: 100, source };
function workspace() {
  return createLabelWorkspace([{ id: "label", name: "Label", size: { width: 200, height: 200 }, elements: [image] }]);
}

describe("non-destructive image crop", () => {
  it("updates, retains, and clears a crop without changing the original source or history", () => {
    const ws = workspace();
    const before = ws.getDocument("label")!;
    const change = ws.execute({ type: "update-image", documentId: "label", elementId: "photo", crop });
    expect(change.previousDocument).toEqual(before);
    expect(before.elements[0]).not.toHaveProperty("crop");
    expect(change.document.elements[0]).toMatchObject({ source, crop });
    expect(Object.isFrozen((change.document.elements[0] as LabelImageElement).crop)).toBe(true);
    ws.execute({ type: "update-image", documentId: "label", elementId: "photo", rotation: 90 });
    expect(ws.getDocument("label")!.elements[0]).toMatchObject({ crop, rotation: 90 });
    const cleared = ws.execute({ type: "update-image", documentId: "label", elementId: "photo", crop: null });
    expect(cleared.document.elements[0]).not.toHaveProperty("crop");
    expect(cleared.document.elements[0]).toMatchObject({ source, rotation: 90 });
    expect(cleared.previousDocument!.elements[0]).toMatchObject({ crop });
    // History consumers can restore the immutable previous document unchanged.
    expect(createLabelWorkspace([change.previousDocument!]).render("label").source).toBe(renderLabelDocument(before).source);
  });

  it("round-trips source crops through add, duplicate, and persisted documents", () => {
    const ws = workspace();
    ws.execute({ type: "add-image", documentId: "label", elementId: "new", source, crop });
    ws.execute({ type: "duplicate-element", documentId: "label", elementId: "new", newElementId: "copy" });
    expect(ws.getDocument("label")!.elements.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "new", crop, source }), expect.objectContaining({ id: "copy", crop, source }),
    ]));
    const restored = createLabelWorkspace(JSON.parse(JSON.stringify(ws.listDocuments())));
    expect(restored.render("label")).toEqual(ws.render("label"));
  });

  it.each([
    null, {}, { ...crop, x: -1 }, { ...crop, y: -1 }, { ...crop, width: 0 },
    { ...crop, height: -1 }, { ...crop, sourceWidth: 0 }, { ...crop, sourceHeight: -1 },
    { ...crop, x: Infinity }, { ...crop, y: NaN }, { ...crop, width: Infinity },
    { ...crop, height: NaN }, { ...crop, sourceWidth: Infinity }, { ...crop, sourceHeight: NaN },
    { ...crop, x: 500 }, { ...crop, y: 900 }, { ...crop, width: "400" },
  ])("rejects malformed persisted crop %j", (badCrop) => {
    expect(() => createLabelWorkspace([{ id: "bad", name: "Bad", size: { width: 100, height: 100 }, elements: [{ ...image, crop: badCrop as LabelImageCrop }] }])).toThrow();
  });

  it("rejects invalid updates atomically and permits exact source boundaries", () => {
    const ws = workspace();
    const before = ws.getDocument("label");
    expect(() => ws.execute({ type: "update-image", documentId: "label", elementId: "photo", crop: { ...crop, width: 1000 } })).toThrow(/source image/);
    expect(ws.getDocument("label")).toBe(before);
    ws.execute({ type: "update-image", documentId: "label", elementId: "photo", crop: { ...crop, width: 700, height: 800 } });
    expect(ws.getDocument("label")!.revision).toBe(1);
  });

  it("clips discarded pixels separately from the frame, centering contain letterboxing", () => {
    const ws = workspace();
    ws.execute({ type: "update-image", documentId: "label", elementId: "photo", crop });
    const svg = ws.render("label").source;
    expect(svg).toContain('<svg data-element-id="photo" id="photo" x="10" y="20" width="100" height="100" viewBox="0 0 100 100" overflow="hidden">');
    expect(svg).toContain('<svg x="0" y="25" width="100" height="50" viewBox="100 200 400 200" preserveAspectRatio="none" overflow="hidden">');
    expect(svg).toContain(`<image width="800" height="1000" href="${source}" preserveAspectRatio="none"/>`);
    expect(svg).toBe(renderLabelDocument(ws.getDocument("label")!).source);
  });

  it.each([0, 90, 180, 270] as const)("clips cover while preserving %s-degree frame rotation", (rotation) => {
    const ws = workspace();
    ws.execute({ type: "update-image", documentId: "label", elementId: "photo", crop, fit: "cover", rotation });
    const svg = ws.render("label").source;
    expect(svg).toContain('<svg x="-50" y="0" width="200" height="100" viewBox="100 200 400 200" preserveAspectRatio="none" overflow="hidden">');
    if (rotation) expect(svg).toContain(`<g transform="rotate(${rotation} 60 70)"><svg`);
    else expect(svg).not.toContain("rotate(");
  });

  it("escapes cropped frame IDs and alt text without creating clip URL references", () => {
    const ws = createLabelWorkspace([{ id: "label", name: "Label", size: { width: 200, height: 200 }, elements: [{ ...image, id: 'a"<&', alt: '<script>"', crop }] }]);
    const svg = ws.render("label").source;
    expect(svg).toContain('data-element-id="a&quot;&lt;&amp;"');
    expect(svg).toContain('aria-label="&lt;script&gt;&quot;"');
    expect(svg).not.toContain("url(");
    expect(svg).not.toContain("<script>");
  });
});
