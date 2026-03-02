import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { toPixels, type LabelTemplate } from "@tls/core";

type TemplateSummary = LabelTemplate & {
  category: "full" | "sticker";
  placeholders: string[];
};

type ImageTransform = { x: number; y: number; scale: number };

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  `${window.location.protocol}//${window.location.hostname}:3001`;

const App = () => {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [filter, setFilter] = useState<"all" | "full" | "sticker">("all");
  const [selectedId, setSelectedId] = useState<string>("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [imageTransforms, setImageTransforms] = useState<Record<string, ImageTransform>>({});
  const [previewSrc, setPreviewSrc] = useState<string>("");

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const imageLayers = selectedTemplate?.layers.filter((layer) => layer.type === "image") ?? [];
  const activeImageLayer = imageLayers[0] as
    | (Extract<LabelTemplate["layers"][number], { type: "image" }> & { type: "image" })
    | undefined;

  useEffect(() => {
    fetch(`${API_BASE}/templates?category=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates ?? []);
      })
      .catch(() => setTemplates([]));
  }, [filter]);

  useEffect(() => {
    if (!templates.length) return;
    if (!selectedId || !templates.some((t) => t.id === selectedId)) {
      setSelectedId(templates[0].id);
    }
  }, [templates, selectedId]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const nextFields: Record<string, string> = {};
    for (const key of selectedTemplate.placeholders) {
      nextFields[key] = fields[key] ?? "";
    }
    setFields(nextFields);
  }, [selectedTemplate?.id]);

  const updateImageFile = (layerId: string, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setImageMap((prev) => ({ ...prev, [layerId]: result }));
      setImageTransforms((prev) => ({
        ...prev,
        [layerId]: prev[layerId] ?? { x: 0, y: 0, scale: 1 }
      }));
    };
    reader.readAsDataURL(file);
  };

  const updatePreview = async () => {
    if (!selectedTemplate) return;
    const response = await fetch(`${API_BASE}/templates/${selectedTemplate.id}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overrides: { ...fields, ...imageMap },
        imageTransforms
      })
    });
    const data = await response.json();
    if (data.pngBase64) {
      setPreviewSrc(`data:image/png;base64,${data.pngBase64}`);
    }
  };

  useEffect(() => {
    updatePreview().catch(() => undefined);
  }, [selectedTemplate?.id]);

  return (
    <main className="app">
      <h1>Thermal Label Studio (MVP)</h1>

      <section className="controls card">
        <label>
          Template type
          <select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "full" | "sticker")}>
            <option value="all">All</option>
            <option value="full">Full-size 4x6</option>
            <option value="sticker">2x3 Sticker sheet</option>
          </select>
        </label>

        <label>
          Template
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Fields</h2>
          {!selectedTemplate ? (
            <p>Loading templates…</p>
          ) : (
            <>
              {selectedTemplate.placeholders.map((key) => {
                const isImage = imageLayers.some((layer) => layer.source.includes(`{{${key}}}`));
                return (
                  <label key={key}>
                    {key}
                    {isImage ? (
                      <input type="file" accept="image/*" onChange={(e) => updateImageFile(activeImageLayer?.id ?? key, e.target.files?.[0] ?? null)} />
                    ) : (
                      <input
                        value={fields[key] ?? ""}
                        onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={`Enter ${key}`}
                      />
                    )}
                  </label>
                );
              })}
            </>
          )}
        </div>

        <ImageViewportCard
          layer={activeImageLayer}
          imageSrc={activeImageLayer ? imageMap[activeImageLayer.id] : ""}
          transform={activeImageLayer ? imageTransforms[activeImageLayer.id] : undefined}
          onChange={(next) => {
            if (!activeImageLayer) return;
            setImageTransforms((prev) => ({ ...prev, [activeImageLayer.id]: next }));
          }}
        />

        <div className="card previewCard">
          <h2>4x6 Preview</h2>
          {selectedTemplate && (
            <p>
              Output: {toPixels(selectedTemplate.size.width, selectedTemplate.size.unit)} x{" "}
              {toPixels(selectedTemplate.size.height, selectedTemplate.size.unit)} px @ 203 DPI
            </p>
          )}
          <button onClick={() => updatePreview().catch(() => undefined)}>Refresh Preview</button>
          {previewSrc ? <img className="previewImg" src={previewSrc} alt="Rendered preview" /> : <p>No preview yet.</p>}
        </div>
      </section>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Inter, system-ui, -apple-system, sans-serif; background: #f3f4f6; }
        .app { padding: 12px; max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 1.2rem; margin: 0 0 12px; }
        h2 { margin: 0 0 8px; font-size: 1rem; }
        .card { background: white; border-radius: 12px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
        .controls { display: grid; gap: 8px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        label { display: grid; gap: 4px; margin-bottom: 8px; font-size: 0.9rem; }
        input, select, button { padding: 10px; border: 1px solid #c7c7c7; border-radius: 8px; font: inherit; }
        .previewImg { width: 100%; max-width: 420px; border: 1px solid #ccc; background: #fff; }
        .previewCard { display: grid; gap: 8px; }

        .viewport {
          width: 100%;
          aspect-ratio: 4/3;
          border: 1px dashed #999;
          background: #fafafa;
          position: relative;
          overflow: hidden;
          touch-action: none;
        }
        .viewport img { position: absolute; left: 0; top: 0; user-select: none; -webkit-user-drag: none; }

        @media (min-width: 900px) {
          .app { padding: 20px; }
          .grid { grid-template-columns: 1fr 1fr 1fr; align-items: start; }
          h1 { font-size: 1.5rem; }
        }
      `}</style>
    </main>
  );
};

const ImageViewportCard = ({
  layer,
  imageSrc,
  transform,
  onChange
}: {
  layer?: Extract<LabelTemplate["layers"][number], { type: "image" }>;
  imageSrc?: string;
  transform?: ImageTransform;
  onChange: (value: ImageTransform) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  if (!layer) {
    return (
      <div className="card">
        <h2>Image viewport</h2>
        <p>This template has no image placeholder.</p>
      </div>
    );
  }

  const current = transform ?? { x: 0, y: 0, scale: 1 };

  return (
    <div className="card">
      <h2>Image viewport</h2>
      <p>
        Placeholder: {layer.id} ({layer.width} x {layer.height}px)
      </p>
      <div
        ref={ref}
        className="viewport"
        onPointerDown={(e) => {
          draggingRef.current = { x: current.x, y: current.y, startX: e.clientX, startY: e.clientY };
        }}
        onPointerMove={(e) => {
          const drag = draggingRef.current;
          if (!drag) return;
          onChange({
            ...current,
            x: drag.x + (e.clientX - drag.startX),
            y: drag.y + (e.clientY - drag.startY)
          });
        }}
        onPointerUp={() => {
          draggingRef.current = null;
        }}
        onPointerLeave={() => {
          draggingRef.current = null;
        }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="Uploaded"
            draggable={false}
            style={{
              left: `${current.x}px`,
              top: `${current.y}px`,
              width: `${Math.max(40, layer.width * current.scale)}px`,
              height: `${Math.max(40, layer.height * current.scale)}px`,
              objectFit: "cover"
            }}
          />
        ) : (
          <p style={{ margin: 10, color: "#666" }}>Upload an image to drag/scale it here.</p>
        )}
      </div>
      <label>
        Scale ({current.scale.toFixed(2)}x)
        <input
          type="range"
          min={0.3}
          max={3}
          step={0.05}
          value={current.scale}
          onChange={(e) => onChange({ ...current, scale: Number(e.target.value) })}
        />
      </label>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
