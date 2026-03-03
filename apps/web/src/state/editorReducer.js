import { createEmptyTemplate, createTextLayer, createShapeLayer, createImageLayer, duplicateLayer, alignLayers, CANVAS_TARGET, } from "@tls/core";
// Non-undoable actions that don't create history entries
const NON_UNDOABLE = [
    "SELECT_LAYER",
    "SELECT_ALL",
    "DESELECT_ALL",
    "SET_ZOOM",
    "SET_PAN",
    "TOGGLE_SNAP",
    "TOGGLE_GRID",
    "COPY",
    "UNDO",
    "REDO",
];
// ── Initial state ────────────────────────────────────────────────
export const createInitialEditorState = (template) => ({
    template: template ?? createEmptyTemplate(),
    selectedLayerIds: [],
    clipboard: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    snapEnabled: true,
    showGrid: false,
});
export const createInitialUndoableState = (template) => ({
    past: [],
    present: createInitialEditorState(template),
    future: [],
});
// ── Inner reducer (operates on EditorState) ──────────────────────
const innerReducer = (state, action) => {
    const { template } = state;
    const layers = template.layers;
    const updateLayers = (fn) => ({
        ...state,
        template: { ...template, layers: fn(layers) },
    });
    const updateLayerById = (id, fn) => updateLayers((ls) => ls.map((l) => (l.id === id ? fn(l) : l)));
    switch (action.type) {
        case "LOAD_TEMPLATE":
            return {
                ...createInitialEditorState(action.template),
                zoom: state.zoom,
                panX: 0,
                panY: 0,
                snapEnabled: state.snapEnabled,
                showGrid: state.showGrid,
            };
        case "SET_TEMPLATE_NAME":
            return { ...state, template: { ...template, name: action.name } };
        case "ADD_TEXT_LAYER": {
            const layer = createTextLayer(action.overrides);
            return {
                ...updateLayers((ls) => [...ls, layer]),
                selectedLayerIds: [layer.id],
            };
        }
        case "ADD_SHAPE_LAYER": {
            const layer = createShapeLayer(action.overrides);
            return {
                ...updateLayers((ls) => [...ls, layer]),
                selectedLayerIds: [layer.id],
            };
        }
        case "ADD_IMAGE_LAYER": {
            const layer = createImageLayer(action.overrides);
            return {
                ...updateLayers((ls) => [...ls, layer]),
                selectedLayerIds: [layer.id],
            };
        }
        case "SELECT_LAYER":
            if (action.multi) {
                const ids = state.selectedLayerIds.includes(action.id)
                    ? state.selectedLayerIds.filter((id) => id !== action.id)
                    : [...state.selectedLayerIds, action.id];
                return { ...state, selectedLayerIds: ids };
            }
            return { ...state, selectedLayerIds: [action.id] };
        case "SELECT_ALL":
            return { ...state, selectedLayerIds: layers.map((l) => l.id) };
        case "DESELECT_ALL":
            return { ...state, selectedLayerIds: [] };
        case "UPDATE_LAYER":
            return updateLayerById(action.id, (l) => ({ ...l, ...action.changes }));
        case "MOVE_LAYER":
            return updateLayerById(action.id, (l) => ({ ...l, x: action.x, y: action.y }));
        case "RESIZE_LAYER":
            return updateLayerById(action.id, (l) => ({
                ...l,
                width: Math.max(10, action.width),
                height: Math.max(10, action.height),
                ...(action.x !== undefined ? { x: action.x } : {}),
                ...(action.y !== undefined ? { y: action.y } : {}),
            }));
        case "ROTATE_LAYER":
            return updateLayerById(action.id, (l) => ({ ...l, rotation: action.rotation }));
        case "DELETE_SELECTED": {
            const ids = new Set(state.selectedLayerIds);
            return {
                ...updateLayers((ls) => ls.filter((l) => !ids.has(l.id))),
                selectedLayerIds: [],
            };
        }
        case "DUPLICATE_SELECTED": {
            const ids = new Set(state.selectedLayerIds);
            const originals = layers.filter((l) => ids.has(l.id));
            const duped = originals.map(duplicateLayer);
            return {
                ...updateLayers((ls) => [...ls, ...duped]),
                selectedLayerIds: duped.map((l) => l.id),
            };
        }
        case "COPY": {
            const ids = new Set(state.selectedLayerIds);
            return { ...state, clipboard: layers.filter((l) => ids.has(l.id)) };
        }
        case "PASTE": {
            if (state.clipboard.length === 0)
                return state;
            const pasted = state.clipboard.map(duplicateLayer);
            return {
                ...updateLayers((ls) => [...ls, ...pasted]),
                selectedLayerIds: pasted.map((l) => l.id),
            };
        }
        case "BRING_FORWARD": {
            const idx = layers.findIndex((l) => l.id === action.id);
            if (idx < 0 || idx >= layers.length - 1)
                return state;
            const next = [...layers];
            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
            return updateLayers(() => next);
        }
        case "SEND_BACKWARD": {
            const idx = layers.findIndex((l) => l.id === action.id);
            if (idx <= 0)
                return state;
            const next = [...layers];
            [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
            return updateLayers(() => next);
        }
        case "BRING_TO_FRONT": {
            const idx = layers.findIndex((l) => l.id === action.id);
            if (idx < 0)
                return state;
            const layer = layers[idx];
            return updateLayers((ls) => [...ls.filter((l) => l.id !== action.id), layer]);
        }
        case "SEND_TO_BACK": {
            const idx = layers.findIndex((l) => l.id === action.id);
            if (idx < 0)
                return state;
            const layer = layers[idx];
            return updateLayers((ls) => [layer, ...ls.filter((l) => l.id !== action.id)]);
        }
        case "TOGGLE_LOCK":
            return updateLayerById(action.id, (l) => ({ ...l, locked: !l.locked }));
        case "TOGGLE_VISIBILITY":
            return updateLayerById(action.id, (l) => ({ ...l, visible: l.visible === false ? true : false }));
        case "ALIGN": {
            const ids = new Set(state.selectedLayerIds);
            const selected = layers.filter((l) => ids.has(l.id));
            if (selected.length === 0)
                return state;
            const cw = template.size.unit === "px" ? template.size.width : CANVAS_TARGET.width;
            const ch = template.size.unit === "px" ? template.size.height : CANVAS_TARGET.height;
            const aligned = alignLayers(selected, action.action, cw, ch);
            const map = new Map(aligned.map((l) => [l.id, l]));
            return updateLayers((ls) => ls.map((l) => map.get(l.id) ?? l));
        }
        case "SET_ZOOM":
            return { ...state, zoom: Math.max(0.1, Math.min(4, action.zoom)) };
        case "SET_PAN":
            return { ...state, panX: action.x, panY: action.y };
        case "TOGGLE_SNAP":
            return { ...state, snapEnabled: !state.snapEnabled };
        case "TOGGLE_GRID":
            return { ...state, showGrid: !state.showGrid };
        default:
            return state;
    }
};
// ── Undo/Redo wrapper reducer ────────────────────────────────────
const MAX_HISTORY = 50;
export const editorReducer = (state, action) => {
    if (action.type === "UNDO") {
        if (state.past.length === 0)
            return state;
        const previous = state.past[state.past.length - 1];
        return {
            past: state.past.slice(0, -1),
            present: previous,
            future: [state.present, ...state.future],
        };
    }
    if (action.type === "REDO") {
        if (state.future.length === 0)
            return state;
        const next = state.future[0];
        return {
            past: [...state.past, state.present],
            present: next,
            future: state.future.slice(1),
        };
    }
    const newPresent = innerReducer(state.present, action);
    if (newPresent === state.present)
        return state;
    // Non-undoable actions don't create history
    if (NON_UNDOABLE.includes(action.type)) {
        return { ...state, present: newPresent };
    }
    return {
        past: [...state.past.slice(-MAX_HISTORY), state.present],
        present: newPresent,
        future: [],
    };
};
