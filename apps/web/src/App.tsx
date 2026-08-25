import React, { useCallback, useMemo, useState } from "react";
import {
  createLabelWorkspace,
  type LabelDocument,
  type LabelElement,
  type RenderArtifact,
  type WorkspaceCommand,
} from "@tls/core";

type Workspace = ReturnType<typeof createLabelWorkspace>;

const sampleDocument: LabelDocument = {
  schemaVersion: 1,
  id: "doc-pantry-bin",
  name: "Pantry bin label",
  revision: 1,
  size: { width: 800, height: 1200 },
  elements: [
    {
      id: "sample-heading",
      type: "text",
      text: "PANTRY",
      x: 88,
      y: 96,
      width: 624,
      height: 104,
      fontSize: 72,
      fontFamily: "Arial, sans-serif",
      fontWeight: 800,
      fill: "#17212b",
    },
    {
      id: "sample-subheading",
      type: "text",
      text: "BAKING SUPPLIES",
      x: 88,
      y: 244,
      width: 624,
      height: 58,
      fontSize: 30,
      fontFamily: "Arial, sans-serif",
      fontWeight: 700,
      fill: "#c75b35",
    },
  ],
};

const workspaceDocument = (workspace: Workspace, fallback: LabelDocument): LabelDocument => {
  return workspace.getDocument(fallback.id) ?? fallback;
};

const workspaceCommand = (workspace: Workspace, next: WorkspaceCommand): LabelDocument => {
  return workspace.execute(next).document;
};

const App: React.FC = () => {
  const workspace = useMemo(() => {
    const next = createLabelWorkspace();
    next.execute({ type: "create-document", document: sampleDocument });
    return next;
  }, []);
  const [document, setDocument] = useState<LabelDocument>(() => workspaceDocument(workspace, sampleDocument));
  const [artifact, setArtifact] = useState<RenderArtifact>(() => workspace.render(sampleDocument.id));
  const [selectedId, setSelectedId] = useState("sample-heading");
  const [nameDraft, setNameDraft] = useState(document.name);
  const [textDraft, setTextDraft] = useState("PANTRY");

  const elements = document.elements;
  const selected = elements.find((element) => element.id === selectedId);

  const apply = useCallback(
    (next: WorkspaceCommand) => {
      const nextDocument = workspaceCommand(workspace, next);
      setDocument(nextDocument);
      setArtifact(workspace.render(nextDocument.id));
    },
    [workspace]
  );

  const rename = useCallback(() => {
    const name = nameDraft.trim();
    if (!name || name === document.name) return;
    apply({ type: "rename-document", documentId: document.id, name });
  }, [apply, document.id, document.name, nameDraft]);

  const addText = useCallback(() => {
    const id = `text-${Date.now().toString(36)}`;
    apply({
      type: "add-text",
      documentId: document.id,
      element: {
        id,
        type: "text",
        text: "NEW TEXT",
        x: 160,
        y: 390,
        width: 480,
        height: 58,
        fontSize: 34,
        fontFamily: "Arial, sans-serif",
        fontWeight: 700,
        fill: "#17212b",
      },
    });
    setSelectedId(id);
    setTextDraft("NEW TEXT");
  }, [apply, document.id]);

  const editText = useCallback(() => {
    if (!selected || selected.type !== "text") return;
    apply({ type: "update-text", documentId: document.id, elementId: selected.id, text: textDraft });
  }, [apply, document.id, selected, textDraft]);

  const move = useCallback((dx: number, dy: number) => {
    if (!selected) return;
    apply({ type: "move-element", documentId: document.id, elementId: selected.id, dx, dy });
  }, [apply, document.id, selected]);

  const select = useCallback((element: LabelElement) => {
    setSelectedId(element.id);
    setTextDraft(element.type === "text" ? element.text : "");
  }, []);

  const svgSource = artifact.source;
  const artifactLabel = `${artifact.documentId}@r${artifact.revision}`;
  const revision = document.revision;
  const width = artifact.width;
  const height = artifact.height;

  return (
    <main className="review-shell">
      <header className="review-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">TL</span>
          <div>
            <p className="eyebrow">Thermal Label Studio</p>
            <h1>Review workspace</h1>
          </div>
        </div>
        <div className="header-status"><span className="status-dot" /> Local review slice</div>
      </header>

      <section className="review-layout">
        <aside className="review-sidebar">
          <div className="sidebar-intro">
            <p className="eyebrow">New workspace</p>
            <p className="sidebar-copy">Shape the label, then inspect the exact rendered artifact before any delivery handoff.</p>
          </div>

          <section className="inspector-card document-card">
            <div className="section-heading"><span>Document</span><span className="revision-chip">r{revision}</span></div>
            <label className="field-label" htmlFor="document-name">Name</label>
            <div className="rename-row">
              <input id="document-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") rename(); }} />
              <button className="icon-button" type="button" onClick={rename} aria-label="Rename document">↵</button>
            </div>
            <dl className="proof-list">
              <div><dt>Document ID</dt><dd>{document.id}</dd></div>
              <div><dt>Revision</dt><dd>{revision}</dd></div>
              <div><dt>Elements</dt><dd>{elements.length}</dd></div>
            </dl>
          </section>

          <section className="inspector-card elements-card">
            <div className="section-heading"><span>Elements</span><button className="add-button" type="button" onClick={addText}>+ Text</button></div>
            <div className="element-list">
              {elements.map((element, index) => (
                <button className={`element-row ${selectedId === element.id ? "selected" : ""}`} type="button" key={element.id} onClick={() => select(element)}>
                  <span className="element-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="element-name">{element.type === "text" ? element.text : "Rectangle"}</span>
                  <span className="element-type">{element.type}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="inspector-card selection-card">
            <div className="section-heading"><span>Selection</span><span className="selection-tag">{selected ? "active" : "none"}</span></div>
            {selected ? (
              <>
                <p className="selection-name">{selected.type === "text" ? selected.text : "Rectangle"}</p>
                {selected.type === "text" && (
                  <>
                    <label className="field-label" htmlFor="selected-text">Text</label>
                    <textarea id="selected-text" value={textDraft} onChange={(event) => setTextDraft(event.target.value)} />
                    <button className="btn-primary" type="button" onClick={editText}>Apply text</button>
                  </>
                )}
                <div className="move-controls">
                  <span className="field-label">Move</span>
                  <div className="move-grid">
                    <button type="button" onClick={() => move(0, -10)} aria-label="Move up">↑</button>
                    <button type="button" onClick={() => move(-10, 0)} aria-label="Move left">←</button>
                    <button type="button" onClick={() => move(10, 0)} aria-label="Move right">→</button>
                    <button type="button" onClick={() => move(0, 10)} aria-label="Move down">↓</button>
                  </div>
                </div>
              </>
            ) : <p className="empty-copy">Select an element to edit or move it.</p>}
          </section>

          <p className="scope-note"><span aria-hidden="true">↗</span> Fleet delivery is outside this slice.</p>
        </aside>

        <section className="preview-column">
          <div className="preview-toolbar">
            <div><p className="eyebrow">Rendered artifact</p><h2>{document.name}</h2></div>
            <div className="artifact-proof"><span className="proof-dot" /> SVG · r{revision}</div>
          </div>

          <div className="paper-stage">
            <div className="paper-frame" style={{ aspectRatio: `${width} / ${height}` }}>
              {svgSource ? <div className="paper-svg" dangerouslySetInnerHTML={{ __html: svgSource }} /> : <div className="empty-preview">No SVG artifact available</div>}
            </div>
          </div>

          <div className="artifact-footer">
            <div className="artifact-meta"><span className="eyebrow">Artifact proof</span><strong>{artifactLabel}</strong><span>{width} × {height} px · document r{revision}</span></div>
            <details className="source-details"><summary>Inspect SVG source</summary><pre>{svgSource || "No source returned by the renderer."}</pre></details>
          </div>
        </section>
      </section>
    </main>
  );
};

export default App;
