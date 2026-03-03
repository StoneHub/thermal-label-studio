import React, { useRef } from "react";
import type { LabelLayer, LabelTextLayer, LabelShapeLayer, LabelImageLayer } from "@tls/core";
import type { EditorApi } from "../hooks/useEditorState";

interface Props {
  editor: EditorApi;
  imageLibrary: Array<{ id: string; name: string; dataUrl: string }>;
  onUploadImageToLayer: (layerId: string, file: File) => void;
  onApplyImageFromLibrary: (layerId: string, assetId: string) => void;
}

const NumberInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}> = ({ label, value, onChange, min, max, step = 1 }) => (
  <div className="prop-row">
    <span className="prop-label">{label}</span>
    <input
      className="prop-input"
      type="number"
      value={Math.round(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
    />
  </div>
);

const TextInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}> = ({ label, value, onChange, multiline }) => (
  <div className="prop-row" style={multiline ? { gridTemplateColumns: "1fr" } : undefined}>
    <span className="prop-label">{label}</span>
    {multiline ? (
      <textarea
        className="prop-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{ resize: "vertical" }}
      />
    ) : (
      <input
        className="prop-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
  </div>
);

const ColorInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="prop-row">
    <span className="prop-label">{label}</span>
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 28, padding: 0, border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }}
      />
      <input
        className="prop-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
      />
    </div>
  </div>
);

const SelectInput: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="prop-row">
    <span className="prop-label">{label}</span>
    <select
      className="prop-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const TextLayerProps: React.FC<{ layer: LabelTextLayer; update: (c: Partial<LabelTextLayer>) => void }> = ({
  layer,
  update,
}) => {
  return (
    <>
      <TextInput label="Text" value={layer.text} onChange={(v) => update({ text: v })} multiline />
      <NumberInput label="Font size" value={layer.fontSize} onChange={(v) => update({ fontSize: v })} min={6} max={200} />
      <SelectInput
        label="Font"
        value={layer.fontFamily ?? "Inter"}
        options={[
          { value: "Inter", label: "Inter" },
          { value: "Arial", label: "Arial" },
          { value: "Georgia", label: "Georgia" },
          { value: "Courier New", label: "Courier" },
          { value: "Impact", label: "Impact" },
          { value: "Comic Sans MS", label: "Comic Sans" },
        ]}
        onChange={(v) => update({ fontFamily: v })}
      />
      <SelectInput
        label="Weight"
        value={String(layer.fontWeight ?? 400)}
        options={[
          { value: "300", label: "Light" },
          { value: "400", label: "Regular" },
          { value: "500", label: "Medium" },
          { value: "600", label: "Semibold" },
          { value: "700", label: "Bold" },
          { value: "800", label: "Extra Bold" },
        ]}
        onChange={(v) => update({ fontWeight: Number(v) })}
      />
      <SelectInput
        label="Align"
        value={layer.align ?? "left"}
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ]}
        onChange={(v) => update({ align: v as "left" | "center" | "right" })}
      />
      <ColorInput label="Color" value={layer.fill ?? "#000000"} onChange={(v) => update({ fill: v })} />
    </>
  );
};

const ShapeLayerProps: React.FC<{ layer: LabelShapeLayer; update: (c: Partial<LabelShapeLayer>) => void }> = ({
  layer,
  update,
}) => {
  return (
    <>
      <SelectInput
        label="Shape"
        value={layer.shapeType}
        options={[
          { value: "rect", label: "Rectangle" },
          { value: "circle", label: "Circle" },
        ]}
        onChange={(v) => update({ shapeType: v as "rect" | "circle" })}
      />
      <ColorInput label="Fill" value={layer.fill ?? "#e0e0e0"} onChange={(v) => update({ fill: v })} />
      <ColorInput label="Stroke" value={layer.stroke ?? "#333333"} onChange={(v) => update({ stroke: v })} />
      <NumberInput
        label="Stroke W"
        value={layer.strokeWidth ?? 2}
        onChange={(v) => update({ strokeWidth: v })}
        min={0}
        max={20}
      />
      {layer.shapeType === "rect" && (
        <NumberInput
          label="Radius"
          value={layer.cornerRadius ?? 0}
          onChange={(v) => update({ cornerRadius: v })}
          min={0}
          max={200}
        />
      )}
    </>
  );
};

const ImageLayerProps: React.FC<{
  layer: LabelImageLayer;
  update: (c: Partial<LabelImageLayer>) => void;
  imageLibrary: Array<{ id: string; name: string; dataUrl: string }>;
  onUploadImageToLayer: (layerId: string, file: File) => void;
  onApplyImageFromLibrary: (layerId: string, assetId: string) => void;
}> = ({
  layer,
  update,
  imageLibrary,
  onUploadImageToLayer,
  onApplyImageFromLibrary,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const currentLibraryAsset =
    imageLibrary.find((asset) => asset.dataUrl === layer.source)?.id ?? "";

  return (
    <>
      <div className="prop-row" style={{ gridTemplateColumns: "1fr" }}>
        <button
          className="btn btn-sm"
          onClick={() => fileRef.current?.click()}
          style={{ width: "100%" }}
        >
          {layer.source ? "Replace image" : "Upload image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadImageToLayer(layer.id, file);
            e.currentTarget.value = "";
          }}
        />
      </div>
      {imageLibrary.length > 0 && (
        <SelectInput
          label="Library"
          value={currentLibraryAsset}
          options={[
            { value: "", label: "Select saved image" },
            ...imageLibrary.map((asset) => ({ value: asset.id, label: asset.name })),
          ]}
          onChange={(assetId) => {
            if (assetId) onApplyImageFromLibrary(layer.id, assetId);
          }}
        />
      )}
      <SelectInput
        label="Fit"
        value={layer.fit ?? "contain"}
        options={[
          { value: "contain", label: "Contain" },
          { value: "cover", label: "Cover" },
          { value: "fill", label: "Fill / Stretch" },
        ]}
        onChange={(v) => update({ fit: v as "contain" | "cover" | "fill" })}
      />
    </>
  );
};

export const PropertiesPanel: React.FC<Props> = ({
  editor,
  imageLibrary,
  onUploadImageToLayer,
  onApplyImageFromLibrary,
}) => {
  const { selectedLayer, selectedLayerIds } = editor;

  if (selectedLayerIds.length === 0) {
    return (
      <div className="panel panel-right">
        <div className="panel-header">Properties</div>
        <div className="empty-state" style={{ padding: 20 }}>
          <div style={{ fontSize: 24, opacity: 0.3 }}>◻</div>
          <div style={{ fontSize: 12 }}>Select a layer to edit</div>
        </div>
      </div>
    );
  }

  if (selectedLayerIds.length > 1) {
    return (
      <div className="panel panel-right">
        <div className="panel-header">Properties</div>
        <div className="panel-section">
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {selectedLayerIds.length} layers selected
          </div>
        </div>
      </div>
    );
  }

  if (!selectedLayer) return null;

  const update = (changes: Partial<LabelLayer>) => {
    editor.updateLayer(selectedLayer.id, changes);
  };

  return (
    <div className="panel panel-right">
      <div className="panel-header">Properties</div>

      {/* Position & Size */}
      <div className="panel-section">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <NumberInput label="X" value={selectedLayer.x} onChange={(v) => update({ x: v })} />
          <NumberInput label="Y" value={selectedLayer.y} onChange={(v) => update({ y: v })} />
          <NumberInput label="W" value={selectedLayer.width} onChange={(v) => update({ width: Math.max(10, v) })} min={10} />
          <NumberInput label="H" value={selectedLayer.height} onChange={(v) => update({ height: Math.max(10, v) })} min={10} />
        </div>
        <NumberInput
          label="Rotation"
          value={selectedLayer.rotation ?? 0}
          onChange={(v) => update({ rotation: v })}
          min={-360}
          max={360}
        />
        <NumberInput
          label="Opacity"
          value={Math.round((selectedLayer.opacity ?? 1) * 100)}
          onChange={(v) => update({ opacity: Math.max(0, Math.min(100, v)) / 100 })}
          min={0}
          max={100}
        />
      </div>

      {/* Type-specific props */}
      <div className="panel-section">
        {selectedLayer.type === "text" && (
          <TextLayerProps layer={selectedLayer as LabelTextLayer} update={update} />
        )}
        {selectedLayer.type === "shape" && (
          <ShapeLayerProps layer={selectedLayer as LabelShapeLayer} update={update} />
        )}
        {selectedLayer.type === "image" && (
          <ImageLayerProps
            layer={selectedLayer as LabelImageLayer}
            update={update}
            imageLibrary={imageLibrary}
            onUploadImageToLayer={onUploadImageToLayer}
            onApplyImageFromLibrary={onApplyImageFromLibrary}
          />
        )}
      </div>
    </div>
  );
};
