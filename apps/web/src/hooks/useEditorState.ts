import { useReducer, useCallback } from "react";
import type { LabelTemplate, LabelTextLayer, LabelShapeLayer, LabelImageLayer, AlignAction } from "@tls/core";
import {
  editorReducer,
  createInitialUndoableState,
  type EditorAction,
  type UndoableState,
} from "../state/editorReducer";

export const useEditorState = (initialTemplate?: LabelTemplate) => {
  const [state, rawDispatch] = useReducer(editorReducer, initialTemplate, createInitialUndoableState);

  const dispatch = useCallback((action: EditorAction) => rawDispatch(action), []);

  const { present } = state;
  const { template, selectedLayerIds, zoom, snapEnabled, showGrid } = present;

  const selectedLayer =
    selectedLayerIds.length === 1
      ? template.layers.find((l) => l.id === selectedLayerIds[0]) ?? null
      : null;

  return {
    // State
    template,
    layers: template.layers,
    selectedLayerIds,
    selectedLayer,
    zoom,
    snapEnabled,
    showGrid,
    clipboard: present.clipboard,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    panX: present.panX,
    panY: present.panY,

    // Raw dispatch
    dispatch,

    // Convenience methods
    loadTemplate: (t: LabelTemplate) => dispatch({ type: "LOAD_TEMPLATE", template: t }),
    setTemplateName: (name: string) => dispatch({ type: "SET_TEMPLATE_NAME", name }),
    addTextLayer: (overrides?: Partial<LabelTextLayer>) => dispatch({ type: "ADD_TEXT_LAYER", overrides }),
    addShapeLayer: (overrides?: Partial<LabelShapeLayer>) => dispatch({ type: "ADD_SHAPE_LAYER", overrides }),
    addImageLayer: (overrides?: Partial<LabelImageLayer>) => dispatch({ type: "ADD_IMAGE_LAYER", overrides }),
    selectLayer: (id: string, multi?: boolean) => dispatch({ type: "SELECT_LAYER", id, multi }),
    selectAll: () => dispatch({ type: "SELECT_ALL" }),
    deselectAll: () => dispatch({ type: "DESELECT_ALL" }),
    updateLayer: (id: string, changes: Partial<any>) => dispatch({ type: "UPDATE_LAYER", id, changes }),
    moveLayer: (id: string, x: number, y: number) => dispatch({ type: "MOVE_LAYER", id, x, y }),
    resizeLayer: (id: string, w: number, h: number, x?: number, y?: number) =>
      dispatch({ type: "RESIZE_LAYER", id, width: w, height: h, x, y }),
    rotateLayer: (id: string, r: number) => dispatch({ type: "ROTATE_LAYER", id, rotation: r }),
    deleteSelected: () => dispatch({ type: "DELETE_SELECTED" }),
    duplicateSelected: () => dispatch({ type: "DUPLICATE_SELECTED" }),
    copy: () => dispatch({ type: "COPY" }),
    paste: () => dispatch({ type: "PASTE" }),
    bringForward: (id: string) => dispatch({ type: "BRING_FORWARD", id }),
    sendBackward: (id: string) => dispatch({ type: "SEND_BACKWARD", id }),
    bringToFront: (id: string) => dispatch({ type: "BRING_TO_FRONT", id }),
    sendToBack: (id: string) => dispatch({ type: "SEND_TO_BACK", id }),
    toggleLock: (id: string) => dispatch({ type: "TOGGLE_LOCK", id }),
    toggleVisibility: (id: string) => dispatch({ type: "TOGGLE_VISIBILITY", id }),
    align: (action: AlignAction) => dispatch({ type: "ALIGN", action }),
    setZoom: (z: number) => dispatch({ type: "SET_ZOOM", zoom: z }),
    setPan: (x: number, y: number) => dispatch({ type: "SET_PAN", x, y }),
    toggleSnap: () => dispatch({ type: "TOGGLE_SNAP" }),
    toggleGrid: () => dispatch({ type: "TOGGLE_GRID" }),
    undo: () => dispatch({ type: "UNDO" }),
    redo: () => dispatch({ type: "REDO" }),
  };
};

export type EditorApi = ReturnType<typeof useEditorState>;
