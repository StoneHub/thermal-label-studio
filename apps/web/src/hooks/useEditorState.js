import { useReducer, useCallback } from "react";
import { editorReducer, createInitialUndoableState, } from "../state/editorReducer";
export const useEditorState = (initialTemplate) => {
    const [state, rawDispatch] = useReducer(editorReducer, initialTemplate, createInitialUndoableState);
    const dispatch = useCallback((action) => rawDispatch(action), []);
    const { present } = state;
    const { template, selectedLayerIds, zoom, snapEnabled, showGrid } = present;
    const selectedLayer = selectedLayerIds.length === 1
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
        loadTemplate: (t) => dispatch({ type: "LOAD_TEMPLATE", template: t }),
        setTemplateName: (name) => dispatch({ type: "SET_TEMPLATE_NAME", name }),
        addTextLayer: (overrides) => dispatch({ type: "ADD_TEXT_LAYER", overrides }),
        addShapeLayer: (overrides) => dispatch({ type: "ADD_SHAPE_LAYER", overrides }),
        addImageLayer: (overrides) => dispatch({ type: "ADD_IMAGE_LAYER", overrides }),
        selectLayer: (id, multi) => dispatch({ type: "SELECT_LAYER", id, multi }),
        selectAll: () => dispatch({ type: "SELECT_ALL" }),
        deselectAll: () => dispatch({ type: "DESELECT_ALL" }),
        updateLayer: (id, changes) => dispatch({ type: "UPDATE_LAYER", id, changes }),
        moveLayer: (id, x, y) => dispatch({ type: "MOVE_LAYER", id, x, y }),
        resizeLayer: (id, w, h, x, y) => dispatch({ type: "RESIZE_LAYER", id, width: w, height: h, x, y }),
        rotateLayer: (id, r) => dispatch({ type: "ROTATE_LAYER", id, rotation: r }),
        deleteSelected: () => dispatch({ type: "DELETE_SELECTED" }),
        duplicateSelected: () => dispatch({ type: "DUPLICATE_SELECTED" }),
        copy: () => dispatch({ type: "COPY" }),
        paste: () => dispatch({ type: "PASTE" }),
        bringForward: (id) => dispatch({ type: "BRING_FORWARD", id }),
        sendBackward: (id) => dispatch({ type: "SEND_BACKWARD", id }),
        bringToFront: (id) => dispatch({ type: "BRING_TO_FRONT", id }),
        sendToBack: (id) => dispatch({ type: "SEND_TO_BACK", id }),
        toggleLock: (id) => dispatch({ type: "TOGGLE_LOCK", id }),
        toggleVisibility: (id) => dispatch({ type: "TOGGLE_VISIBILITY", id }),
        align: (action) => dispatch({ type: "ALIGN", action }),
        setZoom: (z) => dispatch({ type: "SET_ZOOM", zoom: z }),
        setPan: (x, y) => dispatch({ type: "SET_PAN", x, y }),
        toggleSnap: () => dispatch({ type: "TOGGLE_SNAP" }),
        toggleGrid: () => dispatch({ type: "TOGGLE_GRID" }),
        undo: () => dispatch({ type: "UNDO" }),
        redo: () => dispatch({ type: "REDO" }),
    };
};
