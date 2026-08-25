import { describe, expect, it } from "vitest";
import { createLabelWorkspace, renderLabelDocument } from "./index";

describe("LabelWorkspace", () => {
  it("edits a document through commands and increments its revision", () => {
    const workspace = createLabelWorkspace();
    const created = workspace.execute({
      type: "create-document",
      document: {
        id: "shipping",
        name: "Shipping label",
        size: { width: 812, height: 1218 },
        elements: [],
      },
    });

    expect(created.document.revision).toBe(0);
    workspace.execute({
      type: "add-text",
      documentId: "shipping",
      element: { id: "address", x: 20, y: 30, width: 300, height: 40, text: "Old" },
    });
    const updated = workspace.execute({
      type: "update-text",
      documentId: "shipping",
      elementId: "address",
      text: "New",
    });

    expect(updated.document.revision).toBe(2);
    expect(workspace.getDocument("shipping")?.elements[0]).toMatchObject({ id: "address", text: "New" });
    workspace.execute({ type: "move-element", documentId: "shipping", elementId: "address", dx: 5, dy: 7 });
    workspace.execute({ type: "remove-element", documentId: "shipping", elementId: "address" });
    expect(workspace.getDocument("shipping")?.elements).toEqual([]);
    expect(workspace.getDocument("shipping")?.revision).toBe(4);
  });

  it("keeps reads and returned changes immutable", () => {
    const input = {
      id: "immutable",
      name: "Immutable",
      size: { width: 100, height: 200 },
      elements: [{ id: "box", type: "rectangle" as const, x: 0, y: 0, width: 20, height: 20 }],
    };
    const workspace = createLabelWorkspace([input]);
    input.name = "changed outside the workspace";
    const document = workspace.getDocument("immutable");

    expect(document?.name).toBe("Immutable");
    expect(Object.isFrozen(document)).toBe(true);
    expect(Object.isFrozen(document?.elements)).toBe(true);
    expect(() => {
      (document as { name: string }).name = "mutated";
    }).toThrow();
  });

  it("rejects duplicate ids, unknown references, and invalid sizes", () => {
    const workspace = createLabelWorkspace();
    workspace.execute({ type: "create-document", documentId: "label", name: "Label", size: { width: 100, height: 100 } });
    expect(() => workspace.execute({ type: "create-document", documentId: "label", name: "Again", size: { width: 100, height: 100 } })).toThrow(/already in use/);
    expect(() => workspace.execute({ type: "add-text", documentId: "missing", element: { id: "text" } })).toThrow(/was not found/);
    expect(() => workspace.execute({ type: "add-text", documentId: "label", element: { id: "text", width: 0 } })).toThrow(/must be positive/);
    expect(() => workspace.execute({ type: "add-text", documentId: "label", element: { id: "text" } })).not.toThrow();
    expect(() => workspace.execute({ type: "add-text", documentId: "label", element: { id: "text" } })).toThrow(/already in use/);
  });
});

describe("renderLabelDocument", () => {
  it("renders ordered elements as escaped SVG and records the document revision", () => {
    const workspace = createLabelWorkspace();
    workspace.execute({ type: "create-document", documentId: "label<&", name: "Preview", size: { width: 120, height: 80 } });
    workspace.execute({ type: "add-rectangle", documentId: "label<&", element: { id: "background", width: 120, height: 80, fill: "#fff" } });
    workspace.execute({ type: "add-text", documentId: "label<&", element: { id: "title", text: "<&\"" } });
    const document = workspace.getDocument("label<&")!;
    const artifact = renderLabelDocument(document);
    const workspaceArtifact = workspace.render("label<&");

    expect(artifact).toMatchObject({ documentId: "label<&", revision: 2, width: 120, height: 80, mimeType: "image/svg+xml" });
    expect(workspaceArtifact.source).toBe(artifact.source);
    expect(artifact.source.indexOf('id="background"')).toBeLessThan(artifact.source.indexOf('id="title"'));
    expect(artifact.source).toContain("&lt;&amp;&quot;");
    expect(Object.isFrozen(artifact)).toBe(true);
  });
});
