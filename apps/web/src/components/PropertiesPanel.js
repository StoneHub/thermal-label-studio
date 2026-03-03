import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef } from "react";
const NumberInput = ({ label, value, onChange, min, max, step = 1 }) => (_jsxs("div", { className: "prop-row", children: [_jsx("span", { className: "prop-label", children: label }), _jsx("input", { className: "prop-input", type: "number", value: Math.round(value), onChange: (e) => onChange(Number(e.target.value)), min: min, max: max, step: step })] }));
const TextInput = ({ label, value, onChange, multiline }) => (_jsxs("div", { className: "prop-row", style: multiline ? { gridTemplateColumns: "1fr" } : undefined, children: [_jsx("span", { className: "prop-label", children: label }), multiline ? (_jsx("textarea", { className: "prop-input", value: value, onChange: (e) => onChange(e.target.value), rows: 3, style: { resize: "vertical" } })) : (_jsx("input", { className: "prop-input", value: value, onChange: (e) => onChange(e.target.value) }))] }));
const ColorInput = ({ label, value, onChange }) => (_jsxs("div", { className: "prop-row", children: [_jsx("span", { className: "prop-label", children: label }), _jsxs("div", { style: { display: "flex", gap: 4, alignItems: "center" }, children: [_jsx("input", { type: "color", value: value, onChange: (e) => onChange(e.target.value), style: { width: 28, height: 28, padding: 0, border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" } }), _jsx("input", { className: "prop-input", value: value, onChange: (e) => onChange(e.target.value), style: { flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 } })] })] }));
const SelectInput = ({ label, value, options, onChange }) => (_jsxs("div", { className: "prop-row", children: [_jsx("span", { className: "prop-label", children: label }), _jsx("select", { className: "prop-input", value: value, onChange: (e) => onChange(e.target.value), children: options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })] }));
const TextLayerProps = ({ layer, update, }) => {
    return (_jsxs(_Fragment, { children: [_jsx(TextInput, { label: "Text", value: layer.text, onChange: (v) => update({ text: v }), multiline: true }), _jsx(NumberInput, { label: "Font size", value: layer.fontSize, onChange: (v) => update({ fontSize: v }), min: 6, max: 200 }), _jsx(SelectInput, { label: "Font", value: layer.fontFamily ?? "Inter", options: [
                    { value: "Inter", label: "Inter" },
                    { value: "Arial", label: "Arial" },
                    { value: "Georgia", label: "Georgia" },
                    { value: "Courier New", label: "Courier" },
                    { value: "Impact", label: "Impact" },
                    { value: "Comic Sans MS", label: "Comic Sans" },
                ], onChange: (v) => update({ fontFamily: v }) }), _jsx(SelectInput, { label: "Weight", value: String(layer.fontWeight ?? 400), options: [
                    { value: "300", label: "Light" },
                    { value: "400", label: "Regular" },
                    { value: "500", label: "Medium" },
                    { value: "600", label: "Semibold" },
                    { value: "700", label: "Bold" },
                    { value: "800", label: "Extra Bold" },
                ], onChange: (v) => update({ fontWeight: Number(v) }) }), _jsx(SelectInput, { label: "Align", value: layer.align ?? "left", options: [
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                    { value: "right", label: "Right" },
                ], onChange: (v) => update({ align: v }) }), _jsx(ColorInput, { label: "Color", value: layer.fill ?? "#000000", onChange: (v) => update({ fill: v }) })] }));
};
const ShapeLayerProps = ({ layer, update, }) => {
    return (_jsxs(_Fragment, { children: [_jsx(SelectInput, { label: "Shape", value: layer.shapeType, options: [
                    { value: "rect", label: "Rectangle" },
                    { value: "circle", label: "Circle" },
                ], onChange: (v) => update({ shapeType: v }) }), _jsx(ColorInput, { label: "Fill", value: layer.fill ?? "#e0e0e0", onChange: (v) => update({ fill: v }) }), _jsx(ColorInput, { label: "Stroke", value: layer.stroke ?? "#333333", onChange: (v) => update({ stroke: v }) }), _jsx(NumberInput, { label: "Stroke W", value: layer.strokeWidth ?? 2, onChange: (v) => update({ strokeWidth: v }), min: 0, max: 20 }), layer.shapeType === "rect" && (_jsx(NumberInput, { label: "Radius", value: layer.cornerRadius ?? 0, onChange: (v) => update({ cornerRadius: v }), min: 0, max: 200 }))] }));
};
const ImageLayerProps = ({ layer, update, }) => {
    const fileRef = useRef(null);
    const handleFile = (file) => {
        const reader = new FileReader();
        reader.onload = () => {
            update({ source: String(reader.result ?? "") });
        };
        reader.readAsDataURL(file);
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "prop-row", style: { gridTemplateColumns: "1fr" }, children: [_jsx("button", { className: "btn btn-sm", onClick: () => fileRef.current?.click(), style: { width: "100%" }, children: layer.source ? "Replace image" : "Upload image" }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: (e) => {
                            const file = e.target.files?.[0];
                            if (file)
                                handleFile(file);
                        } })] }), _jsx(SelectInput, { label: "Fit", value: layer.fit ?? "contain", options: [
                    { value: "contain", label: "Contain" },
                    { value: "cover", label: "Cover" },
                    { value: "fill", label: "Fill / Stretch" },
                ], onChange: (v) => update({ fit: v }) })] }));
};
export const PropertiesPanel = ({ editor }) => {
    const { selectedLayer, selectedLayerIds } = editor;
    if (selectedLayerIds.length === 0) {
        return (_jsxs("div", { className: "panel panel-right", children: [_jsx("div", { className: "panel-header", children: "Properties" }), _jsxs("div", { className: "empty-state", style: { padding: 20 }, children: [_jsx("div", { style: { fontSize: 24, opacity: 0.3 }, children: "\u25FB" }), _jsx("div", { style: { fontSize: 12 }, children: "Select a layer to edit" })] })] }));
    }
    if (selectedLayerIds.length > 1) {
        return (_jsxs("div", { className: "panel panel-right", children: [_jsx("div", { className: "panel-header", children: "Properties" }), _jsx("div", { className: "panel-section", children: _jsxs("div", { style: { fontSize: 13, color: "var(--text-secondary)" }, children: [selectedLayerIds.length, " layers selected"] }) })] }));
    }
    if (!selectedLayer)
        return null;
    const update = (changes) => {
        editor.updateLayer(selectedLayer.id, changes);
    };
    return (_jsxs("div", { className: "panel panel-right", children: [_jsx("div", { className: "panel-header", children: "Properties" }), _jsxs("div", { className: "panel-section", children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }, children: [_jsx(NumberInput, { label: "X", value: selectedLayer.x, onChange: (v) => update({ x: v }) }), _jsx(NumberInput, { label: "Y", value: selectedLayer.y, onChange: (v) => update({ y: v }) }), _jsx(NumberInput, { label: "W", value: selectedLayer.width, onChange: (v) => update({ width: Math.max(10, v) }), min: 10 }), _jsx(NumberInput, { label: "H", value: selectedLayer.height, onChange: (v) => update({ height: Math.max(10, v) }), min: 10 })] }), _jsx(NumberInput, { label: "Rotation", value: selectedLayer.rotation ?? 0, onChange: (v) => update({ rotation: v }), min: -360, max: 360 }), _jsx(NumberInput, { label: "Opacity", value: Math.round((selectedLayer.opacity ?? 1) * 100), onChange: (v) => update({ opacity: Math.max(0, Math.min(100, v)) / 100 }), min: 0, max: 100 })] }), _jsxs("div", { className: "panel-section", children: [selectedLayer.type === "text" && (_jsx(TextLayerProps, { layer: selectedLayer, update: update })), selectedLayer.type === "shape" && (_jsx(ShapeLayerProps, { layer: selectedLayer, update: update })), selectedLayer.type === "image" && (_jsx(ImageLayerProps, { layer: selectedLayer, update: update }))] })] }));
};
