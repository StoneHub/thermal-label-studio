import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
const layerIcon = (layer) => {
    switch (layer.type) {
        case "text": return "T";
        case "image": return "🖼";
        case "shape": return layer.shapeType === "circle" ? "○" : "◻";
        default: return "?";
    }
};
const layerLabel = (layer) => {
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
export const LayerPanel = ({ editor }) => {
    const { layers, selectedLayerIds } = editor;
    // Show layers in reverse (top layer first in list)
    const reversedLayers = [...layers].reverse();
    return (_jsxs("div", { className: "panel", children: [_jsxs("div", { className: "panel-header", children: ["Layers (", layers.length, ")"] }), _jsx("div", { className: "panel-section", style: { borderBottom: "none", flex: 1 }, children: reversedLayers.length === 0 ? (_jsxs("div", { className: "empty-state", style: { padding: 20 }, children: [_jsx("div", { style: { fontSize: 24, opacity: 0.3 }, children: "\u25FB" }), _jsx("div", { style: { fontSize: 12 }, children: "No layers yet" }), _jsx("div", { style: { fontSize: 11 }, children: "Add text, shapes, or images from the toolbar" })] })) : (reversedLayers.map((layer) => {
                    const isSelected = selectedLayerIds.includes(layer.id);
                    const isHidden = layer.visible === false;
                    const isLocked = layer.locked === true;
                    return (_jsxs("div", { className: `layer-item ${isSelected ? "selected" : ""}`, onClick: (e) => {
                            const multi = e.shiftKey || e.metaKey || e.ctrlKey;
                            editor.selectLayer(layer.id, multi);
                        }, style: { opacity: isHidden ? 0.4 : 1 }, children: [_jsx("span", { className: "layer-icon", children: layerIcon(layer) }), _jsx("span", { className: "layer-name", children: layerLabel(layer) }), _jsxs("span", { className: "layer-actions", children: [_jsx("button", { className: "btn btn-sm btn-ghost btn-icon", style: { padding: 2, minWidth: 22, minHeight: 22, fontSize: 11 }, onClick: (e) => {
                                            e.stopPropagation();
                                            editor.toggleVisibility(layer.id);
                                        }, title: isHidden ? "Show" : "Hide", children: isHidden ? "👁‍🗨" : "👁" }), _jsx("button", { className: "btn btn-sm btn-ghost btn-icon", style: { padding: 2, minWidth: 22, minHeight: 22, fontSize: 11 }, onClick: (e) => {
                                            e.stopPropagation();
                                            editor.toggleLock(layer.id);
                                        }, title: isLocked ? "Unlock" : "Lock", children: isLocked ? "🔒" : "🔓" })] })] }, layer.id));
                })) }), selectedLayerIds.length === 1 && (_jsxs("div", { className: "panel-section", style: { display: "flex", gap: 4, justifyContent: "center", padding: 8 }, children: [_jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.sendToBack(selectedLayerIds[0]), title: "Send to back", children: "\u2913" }), _jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.sendBackward(selectedLayerIds[0]), title: "Send backward", children: "\u2193" }), _jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.bringForward(selectedLayerIds[0]), title: "Bring forward", children: "\u2191" }), _jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.bringToFront(selectedLayerIds[0]), title: "Bring to front", children: "\u2912" })] })), selectedLayerIds.length > 0 && (_jsxs("div", { className: "panel-section", style: { padding: 8 }, children: [_jsx("div", { className: "panel-header", style: { padding: "0 0 6px" }, children: "Align" }), _jsxs("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" }, children: [_jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.align("align-left"), title: "Align left", children: "\u2AF7" }), _jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.align("align-center-h"), title: "Center horizontal", children: "\u229F" }), _jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.align("align-right"), title: "Align right", children: "\u2AF8" }), _jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.align("align-top"), title: "Align top", children: "\u22A4" }), _jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.align("align-center-v"), title: "Center vertical", children: "\u229E" }), _jsx("button", { className: "btn btn-sm btn-icon", onClick: () => editor.align("align-bottom"), title: "Align bottom", children: "\u22A5" })] })] }))] }));
};
