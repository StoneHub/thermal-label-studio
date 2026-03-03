import { useEffect } from "react";
export const useKeyboardShortcuts = (editor) => {
    useEffect(() => {
        const handler = (e) => {
            // Don't capture when typing in inputs
            const tag = e.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
                return;
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;
            const key = e.key.toLowerCase();
            // Undo / Redo
            if (ctrl && key === "z" && !shift) {
                e.preventDefault();
                editor.undo();
                return;
            }
            if (ctrl && key === "z" && shift) {
                e.preventDefault();
                editor.redo();
                return;
            }
            if (ctrl && key === "y") {
                e.preventDefault();
                editor.redo();
                return;
            }
            // Copy / Paste / Duplicate
            if (ctrl && key === "c") {
                e.preventDefault();
                editor.copy();
                return;
            }
            if (ctrl && key === "v") {
                e.preventDefault();
                editor.paste();
                return;
            }
            if (ctrl && key === "d") {
                e.preventDefault();
                editor.duplicateSelected();
                return;
            }
            // Select all
            if (ctrl && key === "a") {
                e.preventDefault();
                editor.selectAll();
                return;
            }
            // Delete
            if (key === "delete" || key === "backspace") {
                e.preventDefault();
                editor.deleteSelected();
                return;
            }
            // Escape
            if (key === "escape") {
                editor.deselectAll();
                return;
            }
            // Arrow keys for nudge
            if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
                if (editor.selectedLayer) {
                    e.preventDefault();
                    const step = shift ? 10 : 1;
                    const { id, x, y } = editor.selectedLayer;
                    switch (key) {
                        case "arrowup":
                            editor.moveLayer(id, x, y - step);
                            break;
                        case "arrowdown":
                            editor.moveLayer(id, x, y + step);
                            break;
                        case "arrowleft":
                            editor.moveLayer(id, x - step, y);
                            break;
                        case "arrowright":
                            editor.moveLayer(id, x + step, y);
                            break;
                    }
                }
                return;
            }
            // Z-order
            if (key === "]" && ctrl && editor.selectedLayer) {
                e.preventDefault();
                if (shift)
                    editor.bringToFront(editor.selectedLayer.id);
                else
                    editor.bringForward(editor.selectedLayer.id);
                return;
            }
            if (key === "[" && ctrl && editor.selectedLayer) {
                e.preventDefault();
                if (shift)
                    editor.sendToBack(editor.selectedLayer.id);
                else
                    editor.sendBackward(editor.selectedLayer.id);
                return;
            }
            // Quick add shortcuts
            if (key === "t" && !ctrl) {
                editor.addTextLayer();
                return;
            }
            if (key === "r" && !ctrl) {
                editor.addShapeLayer();
                return;
            }
            // Zoom
            if ((key === "=" || key === "+") && ctrl) {
                e.preventDefault();
                editor.setZoom(editor.zoom + 0.1);
                return;
            }
            if (key === "-" && ctrl) {
                e.preventDefault();
                editor.setZoom(editor.zoom - 0.1);
                return;
            }
            if (key === "0" && ctrl) {
                e.preventDefault();
                editor.setZoom(1);
                return;
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [editor]);
};
