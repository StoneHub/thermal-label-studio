import { describe, expect, it } from "vitest";
import { documentFromArtwork } from "./documentPages";
import { createEditorSession } from "./editorSession";

describe("PDF label documents", () => {
  const artwork = { name: "Page", dataUrl: "data:image/png;base64,AA==", width: 400, height: 600, sourceKind: "pdf-page" as const };
  it("defaults to filling the label and gives pages independent identities", () => {
    const a = documentFromArtwork(artwork, "a");
    const b = documentFromArtwork(artwork, "b");
    expect(a.elements[0]).toMatchObject({ x: 0, y: 0, width: 800, height: 1200, fit: "cover" });
    expect(a.id).not.toBe(b.id);
    expect(a.elements[0].id).not.toBe(b.elements[0].id);
  });
  it("keeps edits and undo history isolated per page", () => {
    const a = createEditorSession(documentFromArtwork(artwork, "a"));
    const b = createEditorSession(documentFromArtwork(artwork, "b"));
    a.execute({ type: "remove-element", documentId: "a", elementId: "a-image" });
    expect(a.current().elements).toHaveLength(0);
    expect(b.current().elements).toHaveLength(1);
    a.undo();
    expect(a.current().elements).toHaveLength(1);
    expect(b.canUndo).toBe(false);
  });
});
