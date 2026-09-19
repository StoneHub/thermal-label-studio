import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  measureLabelText,
  renderLabelDocument,
  wrapLabelText,
  type LabelDocument,
  type LabelImageElement,
  type LabelTextElement,
  type RenderArtifact,
  type WorkspaceCommand,
} from "@tls/core";
import type { LabelTextMeasure } from "@tls/core";
import { fitArtworkWithin, importArtwork } from "./lib/artworkImport";
import {
  listArtworkHistory,
  loadArtworkSource,
  saveArtworkSource,
  type ArtworkHistoryItem,
} from "./lib/artworkHistory";
import {
  constrainImageGeometry,
  frameImageToLabel,
  initialDocument,
  resizeImageFromCorner,
  withElementGeometry,
  type ElementGeometry,
  type ResizeCorner,
} from "./lib/editorModel";
import { prepareLabelPrintIntent, submitLabelPrintIntent } from "./lib/printIntent";
import { createEditorSession } from "./lib/editorSession";
import { readPrinterStatus, type PrinterStatus } from "./lib/printerStatus";

type DragState = { elementId: string; startX: number; startY: number; originX: number; originY: number };
type FlyoutPanel = "edit" | "layers" | "uploads" | "printer";
type ResizeState = {
  element: LabelImageElement;
  corner: ResizeCorner;
  pointerId: number;
};
const RESIZE_CORNERS: Array<{ corner: ResizeCorner; name: string; className: string }> = [
  { corner: { x: -1, y: -1 }, name: "top left", className: "top-left" },
  { corner: { x: 1, y: -1 }, name: "top right", className: "top-right" },
  { corner: { x: -1, y: 1 }, name: "bottom left", className: "bottom-left" },
  { corner: { x: 1, y: 1 }, name: "bottom right", className: "bottom-right" },
];

let browserTextMeasureContext: CanvasRenderingContext2D | null | undefined;

const browserTextMeasure: LabelTextMeasure = (value, fontSize, fontWeight = 400, letterSpacing = 0, fontFamily = "Arial, sans-serif") => {
  if (typeof window === "undefined") return measureLabelText(value, fontSize, fontWeight, letterSpacing, fontFamily);
  if (browserTextMeasureContext === undefined) {
    const canvas = document.createElement("canvas");
    browserTextMeasureContext = canvas.getContext("2d");
  }
  const context = browserTextMeasureContext;
  if (!context) return measureLabelText(value, fontSize, fontWeight, letterSpacing, fontFamily);
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return context.measureText(value).width + Math.max(0, value.length - 1) * letterSpacing;
};

const textHeightFor = (element: LabelTextElement, text: string): number => {
  const fontSize = element.fontSize ?? 24;
  const lineHeight = element.lineHeight ?? 1.2;
  const lines = wrapLabelText(text, element.width, fontSize, element.fontWeight ?? 400, element.letterSpacing ?? 0, element.fontFamily ?? "Arial, sans-serif", browserTextMeasure);
  return Math.max(1, Math.ceil(lines.length * fontSize * lineHeight));
};

const App: React.FC = () => {
  const workspace = useMemo(() => createEditorSession(initialDocument), []);
  const [document, setDocument] = useState<LabelDocument>(workspace.current);
  const [artifact, setArtifact] = useState<RenderArtifact>(() => renderLabelDocument(initialDocument, { measureText: browserTextMeasure }));
  const [printer, setPrinter] = useState<PrinterStatus | null>(null);
  const [checkingPrinter, setCheckingPrinter] = useState(false);
  const [printMessage, setPrintMessage] = useState("");
  const printingRef = useRef(false);
  const refreshPrinter = useCallback(async () => {
    setCheckingPrinter(true);
    try {
      const next = await readPrinterStatus();
      setPrinter(next);
      return next;
    } catch (error) {
      const next = { ready: false, detail: error instanceof Error ? error.message : "Cannot reach the Pi." };
      setPrinter(next);
      return next;
    } finally { setCheckingPrinter(false); }
  }, []);
  useEffect(() => { void refreshPrinter(); }, [refreshPrinter]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(document.name);
  const [textDraft, setTextDraft] = useState("");
  const [status, setStatus] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [resizePreview, setResizePreview] = useState<ElementGeometry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [artworkHistory, setArtworkHistory] = useState<ArtworkHistoryItem[]>([]);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<FlyoutPanel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const textDraftRef = useRef("");
  const focusTextOnSelectionRef = useRef<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const statusTimer = useRef<number | undefined>(undefined);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    if (statusTimer.current !== undefined) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 3000);
  }, []);
  useEffect(() => () => { if (statusTimer.current !== undefined) window.clearTimeout(statusTimer.current); }, []);
  useEffect(() => {
    let active = true;
    void listArtworkHistory()
      .then((items) => { if (active) setArtworkHistory(items); })
      .catch(() => { if (active) showStatus("Upload history is unavailable."); });
    return () => { active = false; };
  }, [showStatus]);

  const elements = document.elements;
  const selected = elements.find((element) => element.id === selectedId);
  const selectedDraftHeight = selected?.type === "text" ? textHeightFor(selected, textDraft) : 0;
  const hasUnappliedTextDraft = selected?.type === "text" && (textDraft !== selected.text || selectedDraftHeight !== selected.height);
  const textOverflowsLabel = document.elements.some((element) => element.type === "text" && element.y + textHeightFor(element, element.text) > document.size.height)
    || (selected?.type === "text" && selected.y + selectedDraftHeight > document.size.height);
  const printBlocked = hasUnappliedTextDraft || textOverflowsLabel;
  const apply = useCallback((next: WorkspaceCommand | readonly WorkspaceCommand[]) => {
    try {
      const nextDocument = workspace.execute(next);
      setDocument(nextDocument);
      setArtifact(renderLabelDocument(nextDocument, { measureText: browserTextMeasure }));
      return nextDocument;
    } catch {
      showStatus("That change could not be applied.");
      return undefined;
    }
  }, [showStatus, workspace]);

  const travelHistory = useCallback((direction: "undo" | "redo") => {
    const next = workspace[direction]();
    setDocument(next);
    setArtifact(renderLabelDocument(next, { measureText: browserTextMeasure }));
    setNameDraft(next.name);
    const nextSelected = next.elements.find((element) => element.id === selectedId);
    const nextText = nextSelected?.type === "text" ? nextSelected.text : "";
    textDraftRef.current = nextText;
    setTextDraft(nextText);
    setSelectedId((id) => next.elements.some((element) => element.id === id) ? id : null);
    setDrag(null);
    setResize(null);
    setResizePreview(null);
    showStatus(direction === "undo" ? "Edit undone" : "Edit restored");
  }, [selectedId, workspace, showStatus]);

  useEffect(() => {
    if (selected?.type !== "text") {
      if (!selected) {
        textDraftRef.current = "";
        setTextDraft("");
      }
      return;
    }
    textDraftRef.current = selected.text;
    setTextDraft(selected.text);
    if (focusTextOnSelectionRef.current !== selected.id) return;
    focusTextOnSelectionRef.current = null;
    // The direct focus in addText handles browsers that require a user gesture;
    // this is the post-render fallback once the textarea exists in the tree.
    const focusTimer = window.setTimeout(() => {
      const textarea = flyoutRef.current?.querySelector<HTMLTextAreaElement>("#selected-text");
      textarea?.focus({ preventScroll: true });
      textarea?.select();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [selectedId]);

  const rename = useCallback(() => {
    const name = nameDraft.trim();
    if (!name) { setNameDraft(document.name); return; }
    if (name === document.name) return;
    if (apply({ type: "rename-document", documentId: document.id, name })) showStatus(`Renamed to ${name}`);
  }, [apply, document.id, document.name, nameDraft, showStatus]);

  const addText = useCallback(() => {
    const id = `text-${Date.now().toString(36)}`;
    if (apply({ type: "add-text", documentId: document.id, element: { id, type: "text", text: "", x: 80, y: 140, width: 640, height: 160, fontSize: 42, fontFamily: "Arial, sans-serif", fontWeight: 700, fill: "#17212b" } })) {
      lastFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
      focusTextOnSelectionRef.current = id;
      flushSync(() => {
        setSelectedId(id);
        setActivePanel("edit");
        textDraftRef.current = "";
        setTextDraft("");
      });
      flyoutRef.current?.querySelector<HTMLTextAreaElement>("#selected-text")?.focus({ preventScroll: true });
      showStatus("Text added — start typing");
    }
  }, [apply, document.id, showStatus]);

  const addArtwork = useCallback(async (file: File, saveOriginal = true): Promise<boolean> => {
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
        if (saveOriginal) {
          try {
            const historyItem = await saveArtworkSource(file);
            setArtworkHistory((items) => [historyItem, ...items.filter((item) => item.id !== historyItem.id)]);
          } catch (error) {
            showStatus(error instanceof Error ? `${imported.name} added; ${error.message}` : `${imported.name} added; original not saved.`);
            return true;
          }
        }
        showStatus(saveOriginal ? `${imported.name} added and saved` : `${imported.name} added from history`);
        return true;
      }
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "That file could not be added.");
    }
    return false;
  }, [apply, document.id, document.size.height, document.size.width, showStatus]);

  const addFromHistory = useCallback(async (item: ArtworkHistoryItem) => {
    if (historyLoadingId) return;
    setHistoryLoadingId(item.id);
    try {
      const file = await loadArtworkSource(item);
      await addArtwork(file, false);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "That original upload could not be loaded.");
    } finally {
      setHistoryLoadingId(null);
    }
  }, [addArtwork, historyLoadingId, showStatus]);

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
    const currentDocument = workspace.current();
    const currentElement = currentDocument.elements.find((element) => element.id === selectedId);
    const nextText = textDraftRef.current;
    if (!currentElement || currentElement.type !== "text") return;
    const nextHeight = textHeightFor(currentElement, nextText);
    if (currentElement.text === nextText && nextHeight === currentElement.height) return;
    const commands: WorkspaceCommand[] = [{ type: "update-text", documentId: currentDocument.id, elementId: currentElement.id, text: nextText }];
    if (nextHeight !== currentElement.height) {
      commands.push({ type: "resize-element", documentId: currentDocument.id, elementId: currentElement.id, x: currentElement.x, y: currentElement.y, width: currentElement.width, height: nextHeight });
    }
    if (apply(commands)) showStatus("Text updated");
  }, [apply, selectedId, showStatus, workspace]);
  const finishTextEdit = useCallback(() => {
    editText();
    setActivePanel(null);
  }, [editText]);
  const frameImage = useCallback((fit: "contain" | "cover") => {
    if (!selected || selected.type !== "image") return;
    const geometry = frameImageToLabel(selected, document.size);
    if (!apply([
      { type: "resize-element", documentId: document.id, elementId: selected.id, ...geometry },
      { type: "update-image", documentId: document.id, elementId: selected.id, fit },
    ])) return;
    showStatus(fit === "cover" ? "Image fills the label" : "Whole image fitted to the label");
  }, [apply, document.id, document.size, selected, showStatus]);
  const rotateImage = useCallback((direction: -1 | 1) => {
    if (!selected || selected.type !== "image") return;
    const turns = [0, 90, 180, 270] as const;
    const current = turns.indexOf(selected.rotation ?? 0);
    const rotation = turns[(current + direction + turns.length) % turns.length];
    const snapped = frameImageToLabel(selected, document.size);
    const currentlySnapped = selected.x === snapped.x
      && selected.y === snapped.y
      && selected.width === snapped.width
      && selected.height === snapped.height;
    const rotated = { ...selected, rotation };
    const geometry = currentlySnapped
      ? frameImageToLabel(rotated, document.size)
      : constrainImageGeometry(rotated, rotation, document.size);
    if (!apply([
      { type: "update-image", documentId: document.id, elementId: selected.id, rotation },
      { type: "resize-element", documentId: document.id, elementId: selected.id, ...geometry },
    ])) return;
    showStatus(`Rotated to ${rotation}°`);
  }, [apply, document.id, document.size, selected, showStatus]);
  const removeSelected = useCallback(() => {
    if (!selected) return;
    if (apply({ type: "remove-element", documentId: document.id, elementId: selected.id })) { setSelectedId(null); showStatus("Element deleted"); }
  }, [apply, document.id, selected, showStatus]);
  const printOnce = useCallback(async () => {
    if (printingRef.current || document.elements.length === 0) return;
    if (printBlocked) {
      setPrintMessage(textOverflowsLabel ? "Text extends below the printable label. Move or shorten it before printing." : "Apply the current text before printing.");
      return;
    }
    printingRef.current = true;
    setIsPrinting(true);
    setPrintMessage("Checking printer…");
    try {
      const readiness = await refreshPrinter();
      if (!readiness.ready) throw new Error(readiness.detail);
      setPrintMessage("Preparing label…");
      const intent = await prepareLabelPrintIntent(artifact);
      setPrintMessage("Sending one label…");
      const receipt = await submitLabelPrintIntent(intent);
      setPrintMessage(`${receipt.detail} Check the physical label before printing again.`);
    } catch (error) {
      setPrintMessage(error instanceof Error ? error.message : "The print result is unknown. Check the printer before printing again.");
    } finally {
      printingRef.current = false;
      setIsPrinting(false);
    }
  }, [artifact, document.elements.length, printBlocked, refreshPrinter, textOverflowsLabel]);

  useEffect(() => {
    if (!activePanel) {
      lastFocusRef.current?.focus();
      lastFocusRef.current = null;
      return;
    }
    if (!lastFocusRef.current) lastFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      const target = activePanel === "edit" && selected?.type === "text"
        ? flyoutRef.current?.querySelector<HTMLElement>("#selected-text")
        : flyoutRef.current?.querySelector<HTMLElement>("[data-flyout-autofocus]");
      target?.focus({ preventScroll: true });
    }, 0);
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(flyoutRef.current?.querySelectorAll<HTMLElement>("button, input, textarea, [href], [tabindex]:not([tabindex='-1'])") ?? []).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = window.document.activeElement;
      if (!flyoutRef.current?.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onTab);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onTab);
    };
  }, [activePanel, selected?.type]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && !editing && (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")) {
        event.preventDefault();
        travelHistory(event.shiftKey || event.key.toLowerCase() === "y" ? "redo" : "undo");
      }
      else if (event.key === "Escape" && activePanel) {
        event.preventDefault();
        editText();
        setActivePanel(null);
      }
      else if (event.key === "Escape" && !editing) setSelectedId(null);
      else if (modifier && event.key.toLowerCase() === "c" && !editing) { event.preventDefault(); copySelected(); }
      else if (modifier && event.key.toLowerCase() === "d" && !editing) { event.preventDefault(); duplicate(selectedId); }
      else if ((event.key === "Delete" || event.key === "Backspace") && !editing) { event.preventDefault(); removeSelected(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePanel, copySelected, duplicate, editText, removeSelected, selectedId, travelHistory]);
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

  const previewDocument = useMemo(() => {
    if (resize && resizePreview) {
      return withElementGeometry(document, resize.element.id, resizePreview);
    }
    if (drag && (dragOffset.x || dragOffset.y)) {
      const element = document.elements.find((candidate) => candidate.id === drag.elementId);
      const geometry = element?.type === "image"
        ? constrainImageGeometry({
          x: drag.originX + dragOffset.x,
          y: drag.originY + dragOffset.y,
          width: element.width,
          height: element.height,
        }, element.rotation ?? 0, document.size)
        : { x: drag.originX + dragOffset.x, y: drag.originY + dragOffset.y };
      return withElementGeometry(document, drag.elementId, {
        x: geometry.x,
        y: geometry.y,
      });
    }
    return document;
  }, [document, drag, dragOffset, resize, resizePreview]);
  const draftPreviewDocument = useMemo(() => {
    if (!hasUnappliedTextDraft || !selected || selected.type !== "text") return previewDocument;
    return {
      ...previewDocument,
      elements: previewDocument.elements.map((element) => element.id === selected.id ? { ...element, text: textDraft, height: selectedDraftHeight } : element),
    };
  }, [hasUnappliedTextDraft, previewDocument, selected, selectedDraftHeight, textDraft]);
  const previewArtifact = useMemo(
    () => draftPreviewDocument === document ? artifact : renderLabelDocument(draftPreviewDocument, { measureText: browserTextMeasure }),
    [artifact, document, draftPreviewDocument],
  );
  const previewSelected = previewDocument.elements.find((element) => element.id === selectedId);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    editText();
    const target = event.target as Element;
    const elementId = target.closest<SVGElement>("[data-element-id]")?.getAttribute("data-element-id");
    const element = elementId ? document.elements.find((candidate) => candidate.id === elementId) : undefined;
    if (!element) { setSelectedId(null); return; }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(element.id);
    setDrag({ elementId: element.id, startX: event.clientX, startY: event.clientY, originX: element.x, originY: element.y });
    setDragOffset({ x: 0, y: 0 });
  }, [document.elements, editText]);
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !paperRef.current) return;
    const rect = paperRef.current.getBoundingClientRect();
    setDragOffset({ x: (event.clientX - drag.startX) * document.size.width / rect.width, y: (event.clientY - drag.startY) * document.size.height / rect.height });
  }, [document.size.height, document.size.width, drag]);
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const offset = { x: Math.round(dragOffset.x), y: Math.round(dragOffset.y) };
    setDrag(null); setDragOffset({ x: 0, y: 0 });
    if (offset.x || offset.y) {
      const element = document.elements.find((candidate) => candidate.id === drag.elementId);
      const position = element?.type === "image"
        ? constrainImageGeometry({
          x: drag.originX + offset.x,
          y: drag.originY + offset.y,
          width: element.width,
          height: element.height,
        }, element.rotation ?? 0, document.size)
        : { x: drag.originX + offset.x, y: drag.originY + offset.y };
      apply({ type: "move-element", documentId: document.id, elementId: drag.elementId, x: position.x, y: position.y });
    }
  }, [apply, document.id, document.elements, document.size, drag, dragOffset]);
  const onPointerCancel = useCallback(() => {
    setDrag(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const pointOnDocument = useCallback((clientX: number, clientY: number) => {
    const rect = paperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) * document.size.width / rect.width,
      y: (clientY - rect.top) * document.size.height / rect.height,
    };
  }, [document.size.height, document.size.width]);
  const onResizePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>, corner: ResizeCorner) => {
    if (!selected || selected.type !== "image") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResize({ element: selected, corner, pointerId: event.pointerId });
    setResizePreview({ x: selected.x, y: selected.y, width: selected.width, height: selected.height });
  }, [selected]);
  const onResizePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    const point = pointOnDocument(event.clientX, event.clientY);
    if (point) setResizePreview(resizeImageFromCorner(resize.element, resize.corner, point, document.size));
  }, [document.size, pointOnDocument, resize]);
  const finishResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const point = pointOnDocument(event.clientX, event.clientY);
    const geometry = point ? resizeImageFromCorner(resize.element, resize.corner, point, document.size) : resizePreview;
    setResize(null);
    setResizePreview(null);
    if (geometry) {
      apply({
        type: "resize-element",
        documentId: document.id,
        elementId: resize.element.id,
        ...geometry,
      });
    }
  }, [apply, document.id, document.size, pointOnDocument, resize, resizePreview]);
  const cancelResize = useCallback(() => {
    setResize(null);
    setResizePreview(null);
  }, []);
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDropTarget(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }, [addFiles]);

  const width = artifact.width;
  const height = artifact.height;
  const imageSelection = previewSelected?.type === "image" ? previewSelected : null;
  const selectionStyle: React.CSSProperties | undefined = imageSelection ? {
    left: `${imageSelection.x / document.size.width * 100}%`,
    top: `${imageSelection.y / document.size.height * 100}%`,
    width: `${imageSelection.width / document.size.width * 100}%`,
    height: `${imageSelection.height / document.size.height * 100}%`,
    transform: `rotate(${imageSelection.rotation ?? 0}deg)`,
  } : undefined;
  return (
    <main className="editor-shell">
      <header className="editor-header workspace-header">
        <button className="workspace-menu-button" type="button" onClick={() => setActivePanel("layers")} aria-label="Open workspace menu" aria-expanded={activePanel !== null}>☰</button>
        <span className="brand-mark" aria-hidden="true">TL</span>
        <div className="document-name-control"><input aria-label="Label name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onBlur={rename} onKeyDown={(event) => { if (event.key === "Enter") rename(); }} /></div>
        <div className="workspace-header-actions"><button className="workspace-printer-button" type="button" onClick={() => setActivePanel("printer")} aria-label="Open printer details"><span className={`printer-indicator ${printer?.ready ? "ready" : ""}`} aria-hidden="true" /><span className="workspace-printer-label">{printer?.ready ? "Ready" : "Printer"}</span></button><button className="button button-primary workspace-print-button" type="button" onClick={() => { void printOnce(); }} disabled={isPrinting || !printer?.ready || elements.length === 0 || printBlocked} title={printBlocked ? "Resolve text before printing" : undefined}>{isPrinting ? "Printing…" : "Print"}</button></div>
      </header>
      {(printMessage || textOverflowsLabel) && <div className="workspace-alerts">{printMessage && <div className="print-feedback" role="status">{printMessage}<button className="button button-quiet" onClick={() => setPrintMessage("")} disabled={isPrinting} aria-label="Dismiss print message">Dismiss</button></div>}{textOverflowsLabel && <div className="print-feedback overflow-warning" role="alert">Text extends below the printable label. Move or shorten it before printing.</div>}</div>}
      {status && <div className="status-message" role="status">{status}</div>}
      <input className="visually-hidden" hidden ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ""; if (files.length > 0) void addFiles(files); }} aria-label="Import artwork file" />
      {activePanel && <><button className="flyout-backdrop" type="button" aria-label="Close workspace panel" onClick={() => { editText(); setActivePanel(null); }} /><aside className="workspace-flyout" ref={flyoutRef} role="dialog" aria-modal="true" aria-label={`${activePanel} panel`}>
        <div className="flyout-topline"><strong>{activePanel === "edit" ? "Edit" : activePanel === "layers" ? "Layers" : activePanel === "uploads" ? "Uploads" : "Printer"}</strong><button className="button button-quiet" type="button" onClick={() => { editText(); setActivePanel(null); }} data-flyout-autofocus aria-label="Close panel">Close</button></div>
        <nav className="flyout-tabs" aria-label="Workspace panels">{(["edit", "layers", "uploads", "printer"] as FlyoutPanel[]).map((panel) => <button key={panel} className={activePanel === panel ? "active" : ""} type="button" aria-current={activePanel === panel ? "page" : undefined} onClick={() => { editText(); setActivePanel(panel); }}>{panel[0].toUpperCase() + panel.slice(1)}</button>)}</nav>
        <div className="flyout-history-actions" aria-label="History"><button className="button button-quiet" type="button" onClick={() => travelHistory("undo")} disabled={!workspace.canUndo}>Undo</button><button className="button button-quiet" type="button" onClick={() => travelHistory("redo")} disabled={!workspace.canRedo}>Redo</button></div>
        {activePanel === "edit" && <div className="flyout-content"><div className="flyout-section-heading"><span>{selected ? `${selected.type[0].toUpperCase()}${selected.type.slice(1)} selected` : "No selection"}</span></div>{selected ? <div className={`properties-content ${selected.type === "text" ? "text-properties-panel" : ""}`}>{selected.type === "text" ? <><label className="field-label" htmlFor="selected-text">Label text</label><textarea ref={textAreaRef} id="selected-text" placeholder="Type your label text…" value={textDraft} onChange={(event) => { textDraftRef.current = event.target.value; setTextDraft(event.target.value); }} onBlur={editText} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") finishTextEdit(); }} /><p className="control-help">Text wraps live. Press Return for a new line.</p><p className="draft-warning" role="status" style={{ visibility: hasUnappliedTextDraft ? "visible" : "hidden" }}>Preview updated. Done commits before printing.</p><button className="button button-primary full-width" type="button" onClick={finishTextEdit}>Done</button></> : selected.type === "image" ? <><p className="empty-copy">Drag to move. Drag a corner handle to scale.</p><div className="image-controls"><span className="field-label">Framing</span><p className="image-setting-summary">{selected.fit === "cover" ? "Fills label with centered crop" : "Shows the whole image"} · {selected.rotation ?? 0}°</p><div className="property-button-row"><button className="button" type="button" onClick={() => frameImage("contain")}>Fit whole</button><button className="button" type="button" onClick={() => frameImage("cover")}>Fill label</button><button className="button button-quiet" type="button" onClick={() => rotateImage(-1)}>Rotate left</button><button className="button button-quiet" type="button" onClick={() => rotateImage(1)}>Rotate right</button></div></div></> : <p className="empty-copy">Drag the rectangle on the label to reposition it.</p>}<div className="mobile-secondary-action-row"><button className="button button-quiet" type="button" onClick={copySelected}>Copy</button><button className="button button-quiet" type="button" onClick={pasteSelected} disabled={!copiedId && !selectedId}>Paste</button><button className="button button-quiet" type="button" onClick={() => duplicate(selectedId)}>Duplicate</button><button className="button button-danger" type="button" onClick={removeSelected}>Delete</button></div></div> : <p className="empty-copy">Add text or import artwork from the bottom bar.</p>}</div>}
        {activePanel === "layers" && <div className="flyout-content"><div className="layer-list">{elements.map((element, index) => <button className={`layer-row ${selectedId === element.id ? "selected" : ""}`} aria-pressed={selectedId === element.id} type="button" key={element.id} onClick={() => { editText(); setSelectedId(element.id); setActivePanel("edit"); }}><span className="layer-number">{String(index + 1).padStart(2, "0")}</span><span className="layer-label">{element.type === "text" ? element.text || "Empty text" : element.type === "image" ? element.alt || "Image" : "Rectangle"}</span><span className="layer-kind">{element.type}</span></button>)}</div>{elements.length === 0 && <p className="empty-copy">Add text or import artwork from the bottom bar.</p>}</div>}
        {activePanel === "uploads" && <div className="flyout-content">{artworkHistory.length > 0 ? <div className="history-carousel">{artworkHistory.map((item) => <button className="history-card" type="button" key={item.id} onClick={() => { void addFromHistory(item); setActivePanel("edit"); }} disabled={historyLoadingId !== null}>{item.mimeType.startsWith("image/") ? <img src={item.sourceUrl} alt="" loading="lazy" decoding="async" /> : <span className="history-pdf" aria-hidden="true">PDF</span>}<span className="history-name">{item.name}</span>{historyLoadingId === item.id && <span className="history-loading">Loading…</span>}</button>)}</div> : <p className="empty-copy">Your next uploaded image or PDF will appear here.</p>}<button className="button button-primary full-width" type="button" onClick={() => fileInputRef.current?.click()}>Import artwork</button></div>}
        {activePanel === "printer" && <div className="flyout-content"><div className="printer-detail-card"><span className={`printer-indicator ${printer?.ready ? "ready" : ""}`} aria-hidden="true" /><strong>{printer?.ready ? "Printer ready" : printer ? "Printer unavailable" : "Connecting to printer…"}</strong><p>{printer?.detail ?? "Checking the Pi print node."}</p></div><button className="button button-quiet full-width" type="button" onClick={() => { void refreshPrinter(); }} disabled={checkingPrinter || isPrinting}>{checkingPrinter ? "Checking…" : "Refresh status"}</button><p className="control-help">Print submits one guarded label only after the text and bounds checks pass.</p></div>}
      </aside></>}
      <section className="editor-layout">
        <section className="canvas-column"><div className="workspace-bottom-bar" aria-label="Quick label actions"><button className="workspace-bottom-button workspace-bottom-primary" type="button" onClick={addText}>Text</button><button className="workspace-bottom-button" type="button" onClick={() => fileInputRef.current?.click()}>Import</button><button className="workspace-bottom-button" type="button" onClick={() => travelHistory("undo")} disabled={!workspace.canUndo}>Undo</button><button className="workspace-bottom-button" type="button" onClick={() => setActivePanel("edit")} disabled={!selected}>Controls</button></div><div className={`canvas-stage ${isDropTarget ? "drop-target" : ""}`} onDragEnter={(event) => { event.preventDefault(); setIsDropTarget(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDropTarget(false)} onDrop={handleDrop}>{isDropTarget && <div className="drop-overlay">Drop image or PDF</div>}<div ref={paperRef} className="paper-frame" style={{ aspectRatio: `${width} / ${height}` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}><div className="paper-svg" dangerouslySetInnerHTML={{ __html: previewArtifact.source }} />{imageSelection && <div className="image-selection" style={selectionStyle} aria-label="Selected image frame">{RESIZE_CORNERS.map(({ corner, name, className }) => <button key={name} className={`resize-handle ${className}`} type="button" aria-label={`Resize from ${name} corner`} onPointerDown={(event) => onResizePointerDown(event, corner)} onPointerMove={onResizePointerMove} onPointerUp={finishResize} onPointerCancel={cancelResize} />)}</div>}</div></div></section>
      </section>
    </main>
  );
};

export default App;
