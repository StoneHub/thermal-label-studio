import React from "react";
import type { LabelLayer } from "@tls/core";
import type { EditorApi } from "../hooks/useEditorState";

interface Props {
  editor: EditorApi;
}

const layerIcon = (layer: LabelLayer): string => {
  switch (layer.type) {
    case "text": return "T";
    case "image": return "🖼";
    case "shape": return layer.shapeType === "circle" ? "○" : "◻";
    default: return "?";
  }
};

const layerLabel = (layer: LabelLayer): string => {
  switch (layer.type) {
    case "text": {
      const text = layer.text.length > 20 ? layer.text.slice(0, 20) + "…" : layer.text;
      return text || "Empty text";
    }
    case "image": return layer.source ? "Image" : "Image (empty)";
    case "shape": return layer.shapeType === "circle" ? "Circle" : "Rectangle";
    default: return "Layer";
  }
};

export const LayerPanel: React.FC<Props> = ({ editor }) => {
  const { layers, selectedLayerIds } = editor;

  // Show layers in reverse (top layer first in list)
  const reversedLayers = [...layers].reverse();

  return (
    <div className="panel">
      <div className="panel-header">
        Layers ({layers.length})
      </div>

      <div className="panel-section" style={{ borderBottom: "none", flex: 1 }}>
        {reversedLayers.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>
            <div style={{ fontSize: 24, opacity: 0.3 }}>◻</div>
            <div style={{ fontSize: 12 }}>No layers yet</div>
            <div style={{ fontSize: 11 }}>Add text, shapes, or images from the toolbar</div>
          </div>
        ) : (
          reversedLayers.map((layer) => {
            const isSelected = selectedLayerIds.includes(layer.id);
            const isHidden = layer.visible === false;
            const isLocked = layer.locked === true;

            return (
              <div
                key={layer.id}
                className={`layer-item ${isSelected ? "selected" : ""}`}
                onClick={(e) => {
                  const multi = e.shiftKey || e.metaKey || e.ctrlKey;
                  editor.selectLayer(layer.id, multi);
                }}
                style={{ opacity: isHidden ? 0.4 : 1 }}
              >
                <span className="layer-icon">{layerIcon(layer)}</span>
                <span className="layer-name">{layerLabel(layer)}</span>
                <span className="layer-actions">
                  <button
                    className="btn btn-sm btn-ghost btn-icon"
                    style={{ padding: 2, minWidth: 22, minHeight: 22, fontSize: 11 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.toggleVisibility(layer.id);
                    }}
                    title={isHidden ? "Show" : "Hide"}
                  >
                    {isHidden ? "👁‍🗨" : "👁"}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost btn-icon"
                    style={{ padding: 2, minWidth: 22, minHeight: 22, fontSize: 11 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.toggleLock(layer.id);
                    }}
                    title={isLocked ? "Unlock" : "Lock"}
                  >
                    {isLocked ? "🔒" : "🔓"}
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Z-order controls */}
      {selectedLayerIds.length === 1 && (
        <div className="panel-section" style={{ display: "flex", gap: 4, justifyContent: "center", padding: 8 }}>
          <button
            className="btn btn-sm btn-icon"
            onClick={() => editor.sendToBack(selectedLayerIds[0])}
            title="Send to back"
          >
            ⤓
          </button>
          <button
            className="btn btn-sm btn-icon"
            onClick={() => editor.sendBackward(selectedLayerIds[0])}
            title="Send backward"
          >
            ↓
          </button>
          <button
            className="btn btn-sm btn-icon"
            onClick={() => editor.bringForward(selectedLayerIds[0])}
            title="Bring forward"
          >
            ↑
          </button>
          <button
            className="btn btn-sm btn-icon"
            onClick={() => editor.bringToFront(selectedLayerIds[0])}
            title="Bring to front"
          >
            ⤒
          </button>
        </div>
      )}

      {/* Alignment controls */}
      {selectedLayerIds.length > 0 && (
        <div className="panel-section" style={{ padding: 8 }}>
          <div className="panel-header" style={{ padding: "0 0 6px" }}>Align</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button className="btn btn-sm btn-icon" onClick={() => editor.align("align-left")} title="Align left">⫷</button>
            <button className="btn btn-sm btn-icon" onClick={() => editor.align("align-center-h")} title="Center horizontal">⊟</button>
            <button className="btn btn-sm btn-icon" onClick={() => editor.align("align-right")} title="Align right">⫸</button>
            <button className="btn btn-sm btn-icon" onClick={() => editor.align("align-top")} title="Align top">⊤</button>
            <button className="btn btn-sm btn-icon" onClick={() => editor.align("align-center-v")} title="Center vertical">⊞</button>
            <button className="btn btn-sm btn-icon" onClick={() => editor.align("align-bottom")} title="Align bottom">⊥</button>
          </div>
        </div>
      )}
    </div>
  );
};
