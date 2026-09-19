import { describe, expect, it } from "vitest";
import { createEditorSession } from "./editorSession";
import { initialDocument } from "./editorModel";

describe("editor history", () => {
  it("restores deleted content, invalidates redo after edits, and keeps revisions increasing", () => {
    const session = createEditorSession(initialDocument);
    session.execute({ type: "add-text", documentId: initialDocument.id, elementId: "text", text: "Keep me" });
    session.execute({ type: "remove-element", documentId: initialDocument.id, elementId: "text" });
    const revision = session.current().revision;
    expect(session.undo().elements[0]).toMatchObject({ text: "Keep me" });
    expect(session.current().revision).toBeGreaterThan(revision);
    expect(session.redo().elements).toHaveLength(0);
    session.undo();
    session.execute({ type: "rename-document", documentId: initialDocument.id, name: "New label" });
    expect(session.canRedo).toBe(false);
    expect(session.undo().name).toBe(initialDocument.name);
  });

  it("undoes a framing gesture as one edit and rolls back invalid batches", () => {
    const session = createEditorSession(initialDocument);
    session.execute({ type: "add-text", documentId: initialDocument.id, elementId: "text", text: "Hello" });
    const before = session.current();
    session.execute([
      { type: "move-element", documentId: initialDocument.id, elementId: "text", x: 50, y: 60 },
      { type: "update-text", documentId: initialDocument.id, elementId: "text", text: "Changed" },
    ]);
    expect(session.undo().elements).toEqual(before.elements);
    expect(() => session.execute([
      { type: "rename-document", documentId: initialDocument.id, name: "Should roll back" },
      { type: "remove-element", documentId: initialDocument.id, elementId: "missing" },
    ])).toThrow();
    expect(session.current().name).toBe(before.name);
    expect(session.canRedo).toBe(true);
  });

  it("does not create a second undo step for an identical text commit", () => {
    const session = createEditorSession(initialDocument);
    session.execute({ type: "add-text", documentId: initialDocument.id, elementId: "text", text: "" });
    session.execute({ type: "update-text", documentId: initialDocument.id, elementId: "text", text: "First line" });
    session.execute({ type: "update-text", documentId: initialDocument.id, elementId: "text", text: "First line" });

    expect(session.undo().elements[0]).toMatchObject({ text: "" });
    expect(session.redo().elements[0]).toMatchObject({ text: "First line" });
  });

  it("bounds retained edits", () => {
    const session = createEditorSession(initialDocument);
    for (let i = 0; i < 50; i++) session.execute({ type: "rename-document", documentId: initialDocument.id, name: `Label ${i}` });
    for (let i = 0; i < 40; i++) session.undo();
    expect(session.canUndo).toBe(false);
    expect(session.current().name).toBe("Label 9");
  });
});
