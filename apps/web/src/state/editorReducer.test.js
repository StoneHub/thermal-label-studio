import { describe, it, expect } from "vitest";
import { createEmptyTemplate } from "@tls/core";
import { editorReducer, createInitialUndoableState, } from "./editorReducer";
const dispatch = (state, action) => editorReducer(state, action);
const dispatchMany = (state, actions) => actions.reduce((s, a) => editorReducer(s, a), state);
describe("editorReducer", () => {
    it("creates initial state with empty template", () => {
        const state = createInitialUndoableState();
        expect(state.present.template.layers).toEqual([]);
        expect(state.past).toEqual([]);
        expect(state.future).toEqual([]);
    });
    it("loads a template", () => {
        const state = createInitialUndoableState();
        const template = createEmptyTemplate("test");
        template.name = "My Label";
        const next = dispatch(state, { type: "LOAD_TEMPLATE", template });
        expect(next.present.template.name).toBe("My Label");
        expect(next.present.selectedLayerIds).toEqual([]);
    });
    it("adds a text layer and selects it", () => {
        const state = createInitialUndoableState();
        const next = dispatch(state, { type: "ADD_TEXT_LAYER" });
        expect(next.present.template.layers).toHaveLength(1);
        expect(next.present.template.layers[0].type).toBe("text");
        expect(next.present.selectedLayerIds).toHaveLength(1);
    });
    it("adds a shape layer", () => {
        const state = createInitialUndoableState();
        const next = dispatch(state, { type: "ADD_SHAPE_LAYER" });
        expect(next.present.template.layers).toHaveLength(1);
        expect(next.present.template.layers[0].type).toBe("shape");
    });
    it("selects and deselects layers", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        const layerId = state.present.template.layers[0].id;
        state = dispatch(state, { type: "DESELECT_ALL" });
        expect(state.present.selectedLayerIds).toEqual([]);
        state = dispatch(state, { type: "SELECT_LAYER", id: layerId });
        expect(state.present.selectedLayerIds).toEqual([layerId]);
    });
    it("multi-selects layers", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        state = dispatch(state, { type: "ADD_SHAPE_LAYER" });
        const ids = state.present.template.layers.map((l) => l.id);
        state = dispatch(state, { type: "SELECT_LAYER", id: ids[0] });
        state = dispatch(state, { type: "SELECT_LAYER", id: ids[1], multi: true });
        expect(state.present.selectedLayerIds).toEqual(ids);
        // Toggle off
        state = dispatch(state, { type: "SELECT_LAYER", id: ids[0], multi: true });
        expect(state.present.selectedLayerIds).toEqual([ids[1]]);
    });
    it("deletes selected layers", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        state = dispatch(state, { type: "ADD_SHAPE_LAYER" });
        expect(state.present.template.layers).toHaveLength(2);
        // Select first, delete
        const id = state.present.template.layers[0].id;
        state = dispatch(state, { type: "SELECT_LAYER", id });
        state = dispatch(state, { type: "DELETE_SELECTED" });
        expect(state.present.template.layers).toHaveLength(1);
        expect(state.present.selectedLayerIds).toEqual([]);
    });
    it("duplicates selected layers", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        const id = state.present.template.layers[0].id;
        state = dispatch(state, { type: "SELECT_LAYER", id });
        state = dispatch(state, { type: "DUPLICATE_SELECTED" });
        expect(state.present.template.layers).toHaveLength(2);
        // New layer should be selected, not original
        expect(state.present.selectedLayerIds).toHaveLength(1);
        expect(state.present.selectedLayerIds[0]).not.toBe(id);
    });
    it("moves a layer", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        const id = state.present.template.layers[0].id;
        state = dispatch(state, { type: "MOVE_LAYER", id, x: 100, y: 200 });
        expect(state.present.template.layers[0].x).toBe(100);
        expect(state.present.template.layers[0].y).toBe(200);
    });
    it("resizes a layer with minimum constraint", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        const id = state.present.template.layers[0].id;
        state = dispatch(state, { type: "RESIZE_LAYER", id, width: 5, height: 300 });
        expect(state.present.template.layers[0].width).toBe(10); // clamped
        expect(state.present.template.layers[0].height).toBe(300);
    });
    it("rotates a layer", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        const id = state.present.template.layers[0].id;
        state = dispatch(state, { type: "ROTATE_LAYER", id, rotation: 45 });
        expect(state.present.template.layers[0].rotation).toBe(45);
    });
    it("reorders layers (bring forward / send backward)", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER", overrides: { text: "A" } });
        state = dispatch(state, { type: "ADD_TEXT_LAYER", overrides: { text: "B" } });
        state = dispatch(state, { type: "ADD_TEXT_LAYER", overrides: { text: "C" } });
        const idA = state.present.template.layers[0].id;
        // Bring A forward (swap with B)
        state = dispatch(state, { type: "BRING_FORWARD", id: idA });
        expect(state.present.template.layers[1].id).toBe(idA);
        // Bring A to front
        state = dispatch(state, { type: "BRING_TO_FRONT", id: idA });
        expect(state.present.template.layers[2].id).toBe(idA);
        // Send A to back
        state = dispatch(state, { type: "SEND_TO_BACK", id: idA });
        expect(state.present.template.layers[0].id).toBe(idA);
    });
    it("toggles layer lock and visibility", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        const id = state.present.template.layers[0].id;
        state = dispatch(state, { type: "TOGGLE_LOCK", id });
        expect(state.present.template.layers[0].locked).toBe(true);
        state = dispatch(state, { type: "TOGGLE_LOCK", id });
        expect(state.present.template.layers[0].locked).toBe(false);
        state = dispatch(state, { type: "TOGGLE_VISIBILITY", id });
        expect(state.present.template.layers[0].visible).toBe(false);
    });
    it("copies and pastes layers", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER", overrides: { text: "Copy me" } });
        const id = state.present.template.layers[0].id;
        state = dispatch(state, { type: "SELECT_LAYER", id });
        state = dispatch(state, { type: "COPY" });
        expect(state.present.clipboard).toHaveLength(1);
        state = dispatch(state, { type: "PASTE" });
        expect(state.present.template.layers).toHaveLength(2);
        // Pasted layer should have different id
        expect(state.present.template.layers[1].id).not.toBe(id);
    });
});
// ── Undo / Redo ──────────────────────────────────────────────────
describe("undo/redo", () => {
    it("undoes an action", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        expect(state.present.template.layers).toHaveLength(1);
        state = dispatch(state, { type: "UNDO" });
        expect(state.present.template.layers).toHaveLength(0);
        expect(state.future).toHaveLength(1);
    });
    it("redoes an undone action", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        state = dispatch(state, { type: "UNDO" });
        state = dispatch(state, { type: "REDO" });
        expect(state.present.template.layers).toHaveLength(1);
    });
    it("clears future on new action after undo", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        state = dispatch(state, { type: "UNDO" });
        expect(state.future).toHaveLength(1);
        state = dispatch(state, { type: "ADD_SHAPE_LAYER" });
        expect(state.future).toHaveLength(0);
        expect(state.present.template.layers).toHaveLength(1);
        expect(state.present.template.layers[0].type).toBe("shape");
    });
    it("handles undo at beginning (no-op)", () => {
        const state = createInitialUndoableState();
        const next = dispatch(state, { type: "UNDO" });
        expect(next).toBe(state);
    });
    it("handles redo at end (no-op)", () => {
        const state = createInitialUndoableState();
        const next = dispatch(state, { type: "REDO" });
        expect(next).toBe(state);
    });
    it("non-undoable actions don't create history entries", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "ADD_TEXT_LAYER" });
        const historyLen = state.past.length;
        // Selection, zoom, pan are non-undoable
        state = dispatch(state, { type: "SELECT_LAYER", id: state.present.template.layers[0].id });
        expect(state.past.length).toBe(historyLen);
        state = dispatch(state, { type: "SET_ZOOM", zoom: 2 });
        expect(state.past.length).toBe(historyLen);
    });
});
// ── View controls ────────────────────────────────────────────────
describe("view controls", () => {
    it("sets zoom with clamping", () => {
        let state = createInitialUndoableState();
        state = dispatch(state, { type: "SET_ZOOM", zoom: 5 });
        expect(state.present.zoom).toBe(4); // max
        state = dispatch(state, { type: "SET_ZOOM", zoom: 0.01 });
        expect(state.present.zoom).toBe(0.1); // min
    });
    it("toggles snap", () => {
        let state = createInitialUndoableState();
        expect(state.present.snapEnabled).toBe(true);
        state = dispatch(state, { type: "TOGGLE_SNAP" });
        expect(state.present.snapEnabled).toBe(false);
    });
    it("toggles grid", () => {
        let state = createInitialUndoableState();
        expect(state.present.showGrid).toBe(false);
        state = dispatch(state, { type: "TOGGLE_GRID" });
        expect(state.present.showGrid).toBe(true);
    });
});
