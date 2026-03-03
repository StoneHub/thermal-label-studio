import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from "react";
import { CANVAS_TARGET } from "@tls/core";
import { useEditorState } from "./hooks/useEditorState";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { EditorCanvas } from "./components/EditorCanvas";
import { Toolbar } from "./components/Toolbar";
import { LayerPanel } from "./components/LayerPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { TemplateBrowser } from "./components/TemplateBrowser";
const App = () => {
    const editor = useEditorState();
    useKeyboardShortcuts(editor);
    const [showTemplates, setShowTemplates] = useState(false);
    const [mobileTab, setMobileTab] = useState("canvas");
    const [toasts, setToasts] = useState([]);
    const canvasAreaRef = useRef(null);
    const [canvasSize, setCanvasSize] = useState({ width: 600, height: 800 });
    // Measure canvas area
    useEffect(() => {
        const el = canvasAreaRef.current;
        if (!el)
            return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setCanvasSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const showToast = useCallback((message) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);
    const handleOpenTemplates = useCallback(() => setShowTemplates(true), []);
    const handleCloseTemplates = useCallback(() => setShowTemplates(false), []);
    const handleSelectTemplate = useCallback((template) => {
        editor.loadTemplate(template);
        showToast(`Loaded: ${template.name}`);
    }, [editor, showToast]);
    const handleSaveTemplate = useCallback(() => {
        // Save to localStorage as a simple persistence mechanism
        const key = `tls_template_${editor.template.id}`;
        const saved = JSON.stringify(editor.template);
        localStorage.setItem(key, saved);
        // Also save to the template index
        const indexKey = "tls_saved_templates";
        const index = JSON.parse(localStorage.getItem(indexKey) ?? "[]");
        if (!index.includes(editor.template.id)) {
            index.push(editor.template.id);
            localStorage.setItem(indexKey, JSON.stringify(index));
        }
        showToast(`Saved: ${editor.template.name}`);
    }, [editor.template, showToast]);
    const handleExportPng = useCallback(async () => {
        // Use Konva stage to export
        const stageEl = canvasAreaRef.current?.querySelector("canvas");
        if (!stageEl) {
            showToast("No canvas to export");
            return;
        }
        try {
            // Find the Konva stage and export at thermal resolution
            const konvaStage = stageEl.__konvaNode;
            if (!konvaStage) {
                // Fallback: export visible canvas
                const link = document.createElement("a");
                link.download = `${editor.template.name || "label"}.png`;
                link.href = stageEl.toDataURL("image/png");
                link.click();
                showToast("Exported PNG (screen resolution)");
                return;
            }
            // Export at target thermal resolution
            const dataUrl = konvaStage.toDataURL({
                x: 0,
                y: 0,
                width: CANVAS_TARGET.width,
                height: CANVAS_TARGET.height,
                pixelRatio: 1,
            });
            const link = document.createElement("a");
            link.download = `${editor.template.name || "label"}.png`;
            link.href = dataUrl;
            link.click();
            showToast("Exported PNG at 800x1200");
        }
        catch {
            showToast("Export failed - try again");
        }
    }, [editor.template.name, showToast]);
    const isMobile = canvasSize.width < 769;
    return (_jsxs("div", { className: "app-shell", children: [_jsx(Toolbar, { editor: editor, onOpenTemplates: handleOpenTemplates, onSaveTemplate: handleSaveTemplate, onExportPng: handleExportPng }), _jsxs("div", { className: "app-body", children: [(!isMobile || mobileTab === "layers") && (_jsx(LayerPanel, { editor: editor })), (!isMobile || mobileTab === "canvas") && (_jsx("div", { className: "canvas-area", ref: canvasAreaRef, children: _jsx(EditorCanvas, { editor: editor, containerWidth: canvasSize.width, containerHeight: canvasSize.height }) })), (!isMobile || mobileTab === "properties") && (_jsx(PropertiesPanel, { editor: editor }))] }), isMobile && (_jsxs("div", { className: "mobile-tabs", children: [_jsx("button", { className: `mobile-tab ${mobileTab === "layers" ? "active" : ""}`, onClick: () => setMobileTab("layers"), children: "Layers" }), _jsx("button", { className: `mobile-tab ${mobileTab === "canvas" ? "active" : ""}`, onClick: () => setMobileTab("canvas"), children: "Canvas" }), _jsx("button", { className: `mobile-tab ${mobileTab === "properties" ? "active" : ""}`, onClick: () => setMobileTab("properties"), children: "Properties" })] })), _jsxs("div", { className: "status-bar", children: [_jsxs("span", { children: [editor.template.name, " \u2014 ", editor.layers.length, " layers", editor.selectedLayerIds.length > 0 && ` — ${editor.selectedLayerIds.length} selected`] }), _jsxs("span", { children: [CANVAS_TARGET.width, "\u00D7", CANVAS_TARGET.height, " @ 203 DPI"] })] }), showTemplates && (_jsx(TemplateBrowser, { onSelect: handleSelectTemplate, onClose: handleCloseTemplates })), toasts.length > 0 && (_jsx("div", { className: "toast-container", children: toasts.map((t) => (_jsx("div", { className: "toast", children: t.message }, t.id))) }))] }));
};
export default App;
