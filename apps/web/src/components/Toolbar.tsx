import React from "react";
import type { EditorApi } from "../hooks/useEditorState";

interface Props {
  editor: EditorApi;
  onOpenTemplates: () => void;
  onSaveTemplate: () => void;
  onExportPng: () => void;
  onUploadImage: () => void;
  onOpenImageLibrary: () => void;
}

export const Toolbar: React.FC<Props> = ({
  editor,
  onOpenTemplates,
  onSaveTemplate,
  onExportPng,
  onUploadImage,
  onOpenImageLibrary,
}) => {
  return (
    <div className="app-toolbar">
      {/* Brand */}
      <span style={{ fontWeight: 700, fontSize: 15, marginRight: 8, whiteSpace: "nowrap" }}>
        TLS
      </span>

      <div className="toolbar-sep" />

      {/* File actions */}
      <button className="btn btn-sm btn-ghost" onClick={onOpenTemplates} title="Browse templates">
        📋 Templates
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onSaveTemplate} title="Save as template">
        💾 Save
      </button>
      <button className="btn btn-sm btn-ghost" onClick={onExportPng} title="Export PNG">
        📷 Export
      </button>

      <div className="toolbar-sep" />

      {/* Add layers */}
      <button
        className="btn btn-sm"
        onClick={() => editor.addTextLayer()}
        title="Add text (T)"
      >
        T Text
      </button>
      <button
        className="btn btn-sm"
        onClick={() => editor.addShapeLayer()}
        title="Add rectangle (R)"
      >
        ◻ Rect
      </button>
      <button
        className="btn btn-sm"
        onClick={() => editor.addShapeLayer({ shapeType: "circle" })}
        title="Add circle"
      >
        ○ Circle
      </button>
      <button
        className="btn btn-sm"
        onClick={onUploadImage}
        title="Upload image from disk"
      >
        🖼 Upload
      </button>
      <button
        className="btn btn-sm btn-ghost"
        onClick={onOpenImageLibrary}
        title="Use a saved image"
      >
        🗂 Library
      </button>

      <div className="toolbar-sep" />

      {/* Edit actions */}
      <button
        className="btn btn-sm btn-icon"
        onClick={editor.undo}
        disabled={!editor.canUndo}
        title="Undo (Ctrl+Z)"
      >
        ↩
      </button>
      <button
        className="btn btn-sm btn-icon"
        onClick={editor.redo}
        disabled={!editor.canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪
      </button>

      <div className="toolbar-sep" />

      <button
        className="btn btn-sm btn-icon"
        onClick={editor.duplicateSelected}
        disabled={editor.selectedLayerIds.length === 0}
        title="Duplicate (Ctrl+D)"
      >
        ⧉
      </button>
      <button
        className="btn btn-sm btn-icon btn-danger"
        onClick={editor.deleteSelected}
        disabled={editor.selectedLayerIds.length === 0}
        title="Delete (Del)"
      >
        🗑
      </button>

      <div className="toolbar-sep" />

      {/* View controls */}
      <button
        className={`btn btn-sm btn-icon ${editor.snapEnabled ? "btn-active" : ""}`}
        onClick={editor.toggleSnap}
        title="Toggle snap"
      >
        🧲
      </button>
      <button
        className={`btn btn-sm btn-icon ${editor.showGrid ? "btn-active" : ""}`}
        onClick={editor.toggleGrid}
        title="Toggle grid"
      >
        #
      </button>

      <div className="toolbar-sep" />

      {/* Zoom */}
      <span className="toolbar-label">{Math.round(editor.zoom * 100)}%</span>
      <button className="btn btn-sm btn-icon" onClick={() => editor.setZoom(editor.zoom - 0.1)} title="Zoom out">
        −
      </button>
      <button className="btn btn-sm btn-icon" onClick={() => editor.setZoom(editor.zoom + 0.1)} title="Zoom in">
        +
      </button>
      <button className="btn btn-sm btn-icon" onClick={() => editor.setZoom(1)} title="Reset zoom">
        ⊙
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Template name */}
      <input
        className="prop-input"
        style={{ maxWidth: 200, fontSize: 13 }}
        value={editor.template.name}
        onChange={(e) => editor.setTemplateName(e.target.value)}
        placeholder="Template name"
      />
    </div>
  );
};
