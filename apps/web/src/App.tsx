import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createLabelWorkspace,
  type LabelDocument,
  type RenderArtifact,
  type WorkspaceCommand,
} from "@tls/core";
import { fitArtworkWithin, importArtwork } from "./lib/artworkImport";
import { prepareLabelPrintIntent, submitLabelPrintIntent } from "./lib/printIntent";

type Workspace = ReturnType<typeof createLabelWorkspace>;
type DragState = { elementId: string; startX: number; startY: number; originX: number; originY: number };

const sampleDocument: LabelDocument = {
  schemaVersion: 1,
  id: "doc-pantry-bin",
  name: "Pantry bin label",
  revision: 1,
  size: { width: 800, height: 1200 },
  elements: [
    { id: "sample-heading", type: "text", text: "PANTRY", x: 88, y: 96, width: 624, height: 104, fontSize: 72, fontFamily: "Arial, sans-serif", fontWeight: 800, fill: "#17212b" },
    { id: "sample-subheading", type: "text", text: "BAKING SUPPLIES", x: 88, y: 244, width: 624, height: 58, fontSize: 30, fontFamily: "Arial, sans-serif", fontWeight: 700, fill: "#c75b35" },
  ],
};

const App: React.FC = () => {
  const workspace = useMemo(() => {
    const next = createLabelWorkspace();
    next.execute({ type: "create-document", document: sampleDocument });
    return next;
  }, []);
  const [document, setDocument] = useState<LabelDocument>(() => workspace.getDocument(sampleDocument.id) ?? sampleDocument);
  const [artifact, setArtifact] = useState<RenderArtifact>(() => workspace.render(sampleDocument.id));
  const [selectedId, setSelectedId] = useState<string | null>("sample-heading");
  const [nameDraft, setNameDraft] = useState(document.name);
  const [textDraft, setTextDraft] = useState("PANTRY");
  const [status, setStatus] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const statusTimer = useRef<number | undefined>(undefined);
  const savedTransform = useRef<string | null>(null);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    if (statusTimer.current !== undefined) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 3000);
  }, []);
  useEffect(() => () => { if (statusTimer.current !== undefined) window.clearTimeout(statusTimer.current); }, []);

  const elements = document.elements;
  const selected = elements.find((element) => element.id === selectedId);
  const apply = useCallback((next: WorkspaceCommand) => {
    try {
      const nextDocument = workspace.execute(next).document;
      setDocument(nextDocument);
      setArtifact(workspace.render(nextDocument.id));
      return nextDocument;
    } catch {
      showStatus("That change could not be applied.");
      return undefined;
    }
  }, [showStatus, workspace]);

  useEffect(() => {
    if (selected?.type === "text") setTextDraft(selected.text);
    else if (!selected) setTextDraft("");
  }, [selected]);

  const rename = useCallback(() => {
    const name = nameDraft.trim();
    if (!name || name === document.name) return;
    if (apply({ type: "rename-document", documentId: document.id, name })) showStatus(`Renamed to ${name}`);
  }, [apply, document.id, document.name, nameDraft, showStatus]);

  const addText = useCallback(() => {
    const id = `text-${Date.now().toString(36)}`;
    if (apply({ type: "add-text", documentId: document.id, element: { id, type: "text", text: "NEW TEXT", x: 160, y: 390, width: 480, height: 58, fontSize: 34, fontFamily: "Arial, sans-serif", fontWeight: 700, fill: "#17212b" } })) {
      setSelectedId(id);
      setTextDraft("NEW TEXT");
      showStatus("Text added");
    }
  }, [apply, document.id, showStatus]);

  const addArtwork = useCallback(async (file: File) => {
    try {
      const imported = await importArtwork(file);
      const fit = fitArtworkWithin(imported, document.size, 48);
      const id = `image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      if (apply({
        type: "add-image",
        documentId: document.id,
        element: {
          id,
          type: "image",
          source: imported.dataUrl,
          alt: imported.name,
          x: Math.round(fit.x),
          y: Math.round(fit.y),
          width: Math.round(fit.width),
          height: Math.round(fit.height),
        },
      })) {
        setSelectedId(id);
        showStatus(`${imported.name} added`);
      }
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "That file could not be added.");
    }
  }, [apply, document.id, document.size.height, document.size.width, showStatus]);

  const addFiles = useCallback(async (files: readonly File[]) => {
    for (const file of files) await addArtwork(file);
  }, [addArtwork]);

  const duplicate = useCallback((elementId: string | null) => {
    if (!elementId) return;
    const newElementId = `${elementId}-copy-${Date.now().toString(36)}`;
    const next = apply({ type: "duplicate-element", documentId: document.id, elementId, newElementId });
    if (!next) return;
    if (next.elements.some((element) => element.id === newElementId)) setSelectedId(newElementId);
    showStatus("Element duplicated");
  }, [apply, document.id, showStatus]);
  const copySelected = useCallback(() => { if (selected) { setCopiedId(selected.id); showStatus("Element copied"); } }, [selected, showStatus]);
  const pasteSelected = useCallback(() => duplicate(copiedId ?? selectedId), [copiedId, duplicate, selectedId]);
  const editText = useCallback(() => {
    if (!selected || selected.type !== "text") return;
    if (apply({ type: "update-text", documentId: document.id, elementId: selected.id, text: textDraft })) showStatus("Text updated");
  }, [apply, document.id, selected, showStatus, textDraft]);
  const setImageFit = useCallback((fit: "contain" | "cover") => {
    if (!selected || selected.type !== "image") return;
    if (apply({ type: "update-image", documentId: document.id, elementId: selected.id, fit })) {
      showStatus(fit === "cover" ? "Centered crop applied" : "Whole image visible");
    }
  }, [apply, document.id, selected, showStatus]);
  const rotateImage = useCallback((direction: -1 | 1) => {
    if (!selected || selected.type !== "image") return;
    const turns = [0, 90, 180, 270] as const;
    const current = turns.indexOf(selected.rotation ?? 0);
    const rotation = turns[(current + direction + turns.length) % turns.length];
    if (apply({ type: "update-image", documentId: document.id, elementId: selected.id, rotation })) {
      showStatus(`Rotated to ${rotation}°`);
    }
  }, [apply, document.id, selected, showStatus]);
  const move = useCallback((dx: number, dy: number) => { if (selected) apply({ type: "move-element", documentId: document.id, elementId: selected.id, dx, dy }); }, [apply, document.id, selected]);
  const removeSelected = useCallback(() => {
    if (!selected) return;
    if (apply({ type: "remove-element", documentId: document.id, elementId: selected.id })) { setSelectedId(null); showStatus("Element deleted"); }
  }, [apply, document.id, selected, showStatus]);
  const printOnce = useCallback(async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      const intent = await prepareLabelPrintIntent(artifact);
      const receipt = await submitLabelPrintIntent(intent);
      showStatus(receipt.detail);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "The print node rejected the label.");
    } finally {
      setIsPrinting(false);
    }
  }, [artifact, isPrinting, showStatus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "c" && !editing) { event.preventDefault(); copySelected(); }
      else if (modifier && event.key.toLowerCase() === "d" && !editing) { event.preventDefault(); duplicate(selectedId); }
      else if ((event.key === "Delete" || event.key === "Backspace") && !editing) { event.preventDefault(); removeSelected(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySelected, duplicate, removeSelected, selectedId]);
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const directFiles = Array.from(event.clipboardData?.files ?? []);
      const itemFiles = Array.from(event.clipboardData?.items ?? [])
        .map((item) => item.kind === "file" ? item.getAsFile() : null)
        .filter((file): file is File => file !== null);
      const files = directFiles.length > 0 ? directFiles : itemFiles;
      if (files.length > 0) {
        event.preventDefault();
        void addFiles(files);
        return;
      }
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (!editing && (copiedId || selectedId)) {
        event.preventDefault();
        pasteSelected();
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles, copiedId, pasteSelected, selectedId]);

  useEffect(() => {
    const node = drag && paperRef.current?.querySelector(`[data-element-id="${drag.elementId}"]`);
    if (!node) return;
    if (savedTransform.current === null) savedTransform.current = node.getAttribute("transform");
    if (dragOffset.x || dragOffset.y) node.setAttribute("transform", `translate(${dragOffset.x} ${dragOffset.y})`);
    else if (savedTransform.current) node.setAttribute("transform", savedTransform.current);
    return () => { if (savedTransform.current === null) node.removeAttribute("transform"); else node.setAttribute("transform", savedTransform.current); };
  }, [drag, dragOffset]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    const elementId = target.closest<SVGElement>("[data-element-id]")?.getAttribute("data-element-id");
    const element = elementId ? document.elements.find((candidate) => candidate.id === elementId) : undefined;
    if (!element) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(element.id);
    setDrag({ elementId: element.id, startX: event.clientX, startY: event.clientY, originX: element.x, originY: element.y });
    setDragOffset({ x: 0, y: 0 });
    savedTransform.current = null;
  }, [document.elements]);
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !paperRef.current) return;
    const rect = paperRef.current.getBoundingClientRect();
    setDragOffset({ x: (event.clientX - drag.startX) * document.size.width / rect.width, y: (event.clientY - drag.startY) * document.size.height / rect.height });
  }, [document.size.height, document.size.width, drag]);
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const offset = { x: Math.round(dragOffset.x), y: Math.round(dragOffset.y) };
    setDrag(null); setDragOffset({ x: 0, y: 0 }); savedTransform.current = null;
    if (offset.x || offset.y) apply({ type: "move-element", documentId: document.id, elementId: drag.elementId, x: drag.originX + offset.x, y: drag.originY + offset.y });
  }, [apply, document.id, drag, dragOffset]);
  const onPointerCancel = useCallback(() => {
    setDrag(null);
    setDragOffset({ x: 0, y: 0 });
    savedTransform.current = null;
  }, []);
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDropTarget(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }, [addFiles]);

  const width = artifact.width;
  const height = artifact.height;
  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">TL</span><h1>Thermal Label Studio</h1></div>
        <div className="document-name-control"><input aria-label="Label name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onBlur={rename} onKeyDown={(event) => { if (event.key === "Enter") rename(); }} /></div>
        <div className="header-actions">{status && <span className="status-message" role="status">{status}</span>}<button className="button button-primary" type="button" onClick={() => { void printOnce(); }} disabled={isPrinting}>{isPrinting ? "Preparing…" : "Print once"}</button><button className="button button-quiet" type="button" onClick={copySelected} disabled={!selected}>Copy</button><button className="button button-quiet" type="button" onClick={pasteSelected} disabled={!copiedId && !selectedId}>Paste</button><button className="button button-danger" type="button" onClick={removeSelected} disabled={!selected}>Delete</button></div>
      </header>
      <div className="editor-toolbar"><div className="toolbar-group"><button className="button button-primary" type="button" onClick={addText}>Add Text</button><button className="button" type="button" onClick={() => fileInputRef.current?.click()}>Add Image or PDF</button><input ref={fileInputRef} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></div><div className="toolbar-group toolbar-group-right"><button className="button button-quiet" type="button" onClick={() => move(0, -10)} disabled={!selected}>Up</button><button className="button button-quiet" type="button" onClick={() => move(0, 10)} disabled={!selected}>Down</button><button className="button button-quiet" type="button" onClick={() => move(-10, 0)} disabled={!selected}>Left</button><button className="button button-quiet" type="button" onClick={() => move(10, 0)} disabled={!selected}>Right</button><button className="button button-quiet" type="button" onClick={() => duplicate(selectedId)} disabled={!selected}>Duplicate</button></div></div>
      <section className="editor-layout">
        <aside className="layers-panel"><div className="panel-heading"><h2>Layers</h2><span>{elements.length}</span></div><div className="layer-list">{elements.map((element, index) => <button className={`layer-row ${selectedId === element.id ? "selected" : ""}`} type="button" key={element.id} onClick={() => setSelectedId(element.id)}><span className="layer-number">{String(index + 1).padStart(2, "0")}</span><span className="layer-label">{element.type === "text" ? element.text || "Empty text" : "Image"}</span><span className="layer-kind">{element.type}</span></button>)}</div>{elements.length === 0 && <p className="empty-copy">Add text or an image to get started.</p>}</aside>
        <section className="canvas-column"><div className="canvas-heading"><h2>{document.name}</h2><span className="canvas-size">{width} × {height}</span></div><div className={`canvas-stage ${isDropTarget ? "drop-target" : ""}`} onDragEnter={(event) => { event.preventDefault(); setIsDropTarget(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDropTarget(false)} onDrop={handleDrop}>{isDropTarget && <div className="drop-overlay">Drop image or PDF</div>}<div ref={paperRef} className="paper-frame" style={{ aspectRatio: `${width} / ${height}` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}><div className="paper-svg" dangerouslySetInnerHTML={{ __html: artifact.source }} /></div></div></section>
        <aside className="properties-panel"><div className="panel-heading"><h2>Properties</h2></div>{selected ? <div className="properties-content"><p className="selected-kind">{selected.type === "text" ? "Text" : selected.type === "image" ? "Image" : "Rectangle"}</p>{selected.type === "text" ? <><label className="field-label" htmlFor="selected-text">Text</label><textarea id="selected-text" value={textDraft} onChange={(event) => setTextDraft(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") editText(); }} /><button className="button button-primary full-width" type="button" onClick={editText}>Update text</button></> : selected.type === "image" ? <><p className="empty-copy">Drag the image on the canvas to reposition it.</p><div className="image-controls"><span className="field-label">Crop</span><div className="property-button-row"><button className={`button ${selected.fit !== "cover" ? "button-primary" : ""}`} type="button" onClick={() => setImageFit("contain")}>Whole image</button><button className={`button ${selected.fit === "cover" ? "button-primary" : ""}`} type="button" onClick={() => setImageFit("cover")}>Fill and crop</button></div><span className="field-label">Orientation</span><div className="property-button-row"><button className="button" type="button" onClick={() => rotateImage(-1)}>Rotate left</button><button className="button" type="button" onClick={() => rotateImage(1)}>Rotate right</button></div><p className="image-setting-summary">{selected.fit === "cover" ? "Centered crop" : "No crop"} · {selected.rotation ?? 0}°</p></div></> : <p className="empty-copy">Drag the rectangle on the canvas to reposition it.</p>}<div className="property-position"><span>Position</span><strong>{Math.round(selected.x)}, {Math.round(selected.y)}</strong></div></div> : <p className="empty-copy">Select a layer to edit its properties.</p>}</aside>
      </section>
    </main>
  );
};

export default App;
