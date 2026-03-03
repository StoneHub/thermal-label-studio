import React, { useState, useRef, useCallback, useEffect } from "react";
import type { LabelTemplate } from "@tls/core";
import { CANVAS_TARGET } from "@tls/core";
import { useEditorState } from "./hooks/useEditorState";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { EditorCanvas } from "./components/EditorCanvas";
import { Toolbar } from "./components/Toolbar";
import { LayerPanel } from "./components/LayerPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { TemplateBrowser } from "./components/TemplateBrowser";

type MobileTab = "layers" | "canvas" | "properties";
type ImageAsset = { id: string; name: string; dataUrl: string; createdAt: number };
const IMAGE_LIBRARY_KEY = "tls_image_library_v1";

const App: React.FC = () => {
  const editor = useEditorState();
  useKeyboardShortcuts(editor);

  const [showTemplates, setShowTemplates] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [imageLibrary, setImageLibrary] = useState<ImageAsset[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 800 });

  // Measure canvas area
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMAGE_LIBRARY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ImageAsset[];
      if (Array.isArray(parsed)) setImageLibrary(parsed);
    } catch {
      // ignore malformed local data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(IMAGE_LIBRARY_KEY, JSON.stringify(imageLibrary));
  }, [imageLibrary]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const handleOpenTemplates = useCallback(() => setShowTemplates(true), []);
  const handleCloseTemplates = useCallback(() => setShowTemplates(false), []);

  const handleSelectTemplate = useCallback(
    (template: LabelTemplate) => {
      editor.loadTemplate(template);
      showToast(`Loaded: ${template.name}`);
    },
    [editor, showToast]
  );

  const handleSaveTemplate = useCallback(() => {
    // Save to localStorage as a simple persistence mechanism
    const key = `tls_template_${editor.template.id}`;
    const saved = JSON.stringify(editor.template);
    localStorage.setItem(key, saved);

    // Also save to the template index
    const indexKey = "tls_saved_templates";
    const index: string[] = JSON.parse(localStorage.getItem(indexKey) ?? "[]");
    if (!index.includes(editor.template.id)) {
      index.push(editor.template.id);
      localStorage.setItem(indexKey, JSON.stringify(index));
    }

    showToast(`Saved: ${editor.template.name}`);
  }, [editor.template, showToast]);

  const handleExportPng = useCallback(async () => {
    // Use Konva stage to export
    const stageEl = canvasAreaRef.current?.querySelector("canvas");
    if (!stageEl) {
      showToast("No canvas to export");
      return;
    }

    try {
      // Find the Konva stage and export at thermal resolution
      const konvaStage = (stageEl as any).__konvaNode;
      if (!konvaStage) {
        // Fallback: export visible canvas
        const link = document.createElement("a");
        link.download = `${editor.template.name || "label"}.png`;
        link.href = stageEl.toDataURL("image/png");
        link.click();
        showToast("Exported PNG (screen resolution)");
        return;
      }

      // Export at target thermal resolution
      const dataUrl = konvaStage.toDataURL({
        x: 0,
        y: 0,
        width: CANVAS_TARGET.width,
        height: CANVAS_TARGET.height,
        pixelRatio: 1,
      });

      const link = document.createElement("a");
      link.download = `${editor.template.name || "label"}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Exported PNG at 800x1200");
    } catch {
      showToast("Export failed - try again");
    }
  }, [editor.template.name, showToast]);

  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  }, []);

  const saveImageAsset = useCallback((name: string, dataUrl: string): ImageAsset => {
    const asset: ImageAsset = {
      id: `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      dataUrl,
      createdAt: Date.now(),
    };
    setImageLibrary((prev) => [asset, ...prev].slice(0, 200));
    return asset;
  }, []);

  const addLayerFromImage = useCallback((dataUrl: string) => {
    editor.addImageLayer({
      source: dataUrl,
      x: 80,
      y: 80,
      width: 280,
      height: 280,
      fit: "contain",
    });
  }, [editor]);

  const handleUploadImage = useCallback(() => {
    imageUploadInputRef.current?.click();
  }, []);

  const handleUploadImageFile = useCallback(async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      saveImageAsset(file.name, dataUrl);
      addLayerFromImage(dataUrl);
      showToast(`Added image: ${file.name}`);
    } catch {
      showToast("Image upload failed");
    }
  }, [fileToDataUrl, saveImageAsset, addLayerFromImage, showToast]);

  const handleApplyImageFromLibrary = useCallback((layerId: string, assetId: string) => {
    const asset = imageLibrary.find((a) => a.id === assetId);
    if (!asset) return;
    editor.updateLayer(layerId, { source: asset.dataUrl });
    showToast(`Applied: ${asset.name}`);
  }, [imageLibrary, editor, showToast]);

  const handleUploadImageToLayer = useCallback(async (layerId: string, file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      saveImageAsset(file.name, dataUrl);
      editor.updateLayer(layerId, { source: dataUrl });
      showToast(`Updated layer image: ${file.name}`);
    } catch {
      showToast("Image upload failed");
    }
  }, [fileToDataUrl, saveImageAsset, editor, showToast]);

  const handleInsertLibraryImage = useCallback((assetId: string) => {
    const asset = imageLibrary.find((a) => a.id === assetId);
    if (!asset) return;
    addLayerFromImage(asset.dataUrl);
    showToast(`Inserted: ${asset.name}`);
  }, [imageLibrary, addLayerFromImage, showToast]);

  const handleDeleteImageAsset = useCallback((assetId: string) => {
    setImageLibrary((prev) => prev.filter((a) => a.id !== assetId));
  }, []);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (!file) return;
        e.preventDefault();
        await handleUploadImageFile(file);
        return;
      }
      if (editor.clipboard.length > 0) {
        e.preventDefault();
        editor.paste();
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editor, handleUploadImageFile]);

  const isMobile = canvasSize.width < 769;

  return (
    <div className="app-shell">
      <Toolbar
        editor={editor}
        onOpenTemplates={handleOpenTemplates}
        onSaveTemplate={handleSaveTemplate}
        onExportPng={handleExportPng}
        onUploadImage={handleUploadImage}
        onOpenImageLibrary={() => setShowImageLibrary(true)}
      />

      <div className="app-body">
        {/* Layer panel - desktop always visible, mobile conditionally */}
        {(!isMobile || mobileTab === "layers") && (
          <LayerPanel editor={editor} />
        )}

        {/* Canvas area */}
        {(!isMobile || mobileTab === "canvas") && (
          <div className="canvas-area" ref={canvasAreaRef}>
            <EditorCanvas
              editor={editor}
              containerWidth={canvasSize.width}
              containerHeight={canvasSize.height}
            />
          </div>
        )}

        {/* Properties panel - desktop always visible, mobile conditionally */}
        {(!isMobile || mobileTab === "properties") && (
          <PropertiesPanel
            editor={editor}
            imageLibrary={imageLibrary}
            onUploadImageToLayer={handleUploadImageToLayer}
            onApplyImageFromLibrary={handleApplyImageFromLibrary}
          />
        )}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div className="mobile-tabs">
          <button
            className={`mobile-tab ${mobileTab === "layers" ? "active" : ""}`}
            onClick={() => setMobileTab("layers")}
          >
            Layers
          </button>
          <button
            className={`mobile-tab ${mobileTab === "canvas" ? "active" : ""}`}
            onClick={() => setMobileTab("canvas")}
          >
            Canvas
          </button>
          <button
            className={`mobile-tab ${mobileTab === "properties" ? "active" : ""}`}
            onClick={() => setMobileTab("properties")}
          >
            Properties
          </button>
        </div>
      )}

      {/* Status bar */}
      <div className="status-bar">
        <span>
          {editor.template.name} — {editor.layers.length} layers
          {editor.selectedLayerIds.length > 0 && ` — ${editor.selectedLayerIds.length} selected`}
        </span>
        <span>
          {CANVAS_TARGET.width}×{CANVAS_TARGET.height} @ 203 DPI
        </span>
      </div>

      {/* Template browser modal */}
      {showTemplates && (
        <TemplateBrowser onSelect={handleSelectTemplate} onClose={handleCloseTemplates} />
      )}

      {showImageLibrary && (
        <div className="template-modal-backdrop" onClick={() => setShowImageLibrary(false)}>
          <div className="template-modal image-library-modal" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <h3>Image Library</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowImageLibrary(false)}>✕</button>
            </div>
            <div className="image-library-grid">
              {imageLibrary.map((asset) => (
                <div className="image-card" key={asset.id}>
                  <img src={asset.dataUrl} alt={asset.name} />
                  <div className="image-card-meta">
                    <span title={asset.name}>{asset.name}</span>
                    <div className="image-card-actions">
                      <button className="btn btn-sm" onClick={() => handleInsertLibraryImage(asset.id)}>Use</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteImageAsset(asset.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
              {imageLibrary.length === 0 && (
                <div className="empty-state" style={{ gridColumn: "1 / -1", padding: 24 }}>
                  No saved images yet. Upload one from toolbar or paste from clipboard.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className="toast">{t.message}</div>
          ))}
        </div>
      )}

      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUploadImageFile(file);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
};

export default App;
