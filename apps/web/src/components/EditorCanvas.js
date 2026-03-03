import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useCallback, useState } from "react";
import { Stage, Layer, Rect, Text, Transformer, Line, Group, Image as KonvaImage } from "react-konva";
import { computeSnapLines } from "@tls/core";
const CANVAS_W = 800;
const CANVAS_H = 1200;
// Grid pattern spacing
const GRID_SIZE = 25;
export const EditorCanvas = ({ editor, containerWidth, containerHeight }) => {
    const stageRef = useRef(null);
    const transformerRef = useRef(null);
    const layerRef = useRef(null);
    const [snapLines, setSnapLines] = useState([]);
    const [loadedImages, setLoadedImages] = useState({});
    const { template, layers, selectedLayerIds, zoom, snapEnabled, showGrid } = editor;
    // Calculate scale to fit canvas in container
    const padding = 40;
    const scaleToFit = Math.min((containerWidth - padding * 2) / CANVAS_W, (containerHeight - padding * 2) / CANVAS_H, 1);
    const effectiveScale = scaleToFit * zoom;
    const stageWidth = containerWidth;
    const stageHeight = containerHeight;
    const offsetX = (stageWidth - CANVAS_W * effectiveScale) / 2;
    const offsetY = (stageHeight - CANVAS_H * effectiveScale) / 2;
    // Update transformer when selection changes
    useEffect(() => {
        const transformer = transformerRef.current;
        const layer = layerRef.current;
        if (!transformer || !layer)
            return;
        const nodes = selectedLayerIds
            .map((id) => layer.findOne(`#${id}`))
            .filter((n) => n != null);
        transformer.nodes(nodes);
        transformer.getLayer()?.batchDraw();
    }, [selectedLayerIds, layers]);
    // Load images for image layers
    useEffect(() => {
        const imageLayers = layers.filter((l) => l.type === "image" && !!l.source);
        for (const layer of imageLayers) {
            if (layer.source.startsWith("data:") || layer.source.startsWith("http")) {
                if (!loadedImages[layer.id]) {
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.src = layer.source;
                    img.onload = () => {
                        setLoadedImages((prev) => ({ ...prev, [layer.id]: img }));
                    };
                }
            }
        }
    }, [layers]);
    const handleStageClick = useCallback((e) => {
        if (e.target === stageRef.current || e.target.name() === "canvas-bg") {
            editor.deselectAll();
        }
    }, [editor]);
    const handleDragMove = useCallback((layer, node) => {
        if (!snapEnabled)
            return;
        const moving = { ...layer, x: node.x(), y: node.y() };
        const result = computeSnapLines(moving, layers.filter((l) => l.id !== layer.id), CANVAS_W, CANVAS_H);
        if (result.snappedX !== null)
            node.x(result.snappedX);
        if (result.snappedY !== null)
            node.y(result.snappedY);
        setSnapLines(result.lines);
    }, [layers, snapEnabled]);
    const handleDragEnd = useCallback((layer, node) => {
        setSnapLines([]);
        editor.moveLayer(layer.id, Math.round(node.x()), Math.round(node.y()));
    }, [editor]);
    const handleTransformEnd = useCallback((layer, node) => {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        // Reset scale and apply to width/height
        node.scaleX(1);
        node.scaleY(1);
        editor.resizeLayer(layer.id, Math.round(Math.max(10, node.width() * scaleX)), Math.round(Math.max(10, node.height() * scaleY)), Math.round(node.x()), Math.round(node.y()));
        editor.rotateLayer(layer.id, Math.round(node.rotation()));
    }, [editor]);
    const renderLayer = (layer) => {
        if (layer.visible === false)
            return null;
        const isSelected = selectedLayerIds.includes(layer.id);
        const draggable = !layer.locked;
        const commonProps = {
            id: layer.id,
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
            rotation: layer.rotation ?? 0,
            opacity: layer.opacity ?? 1,
            draggable,
            onClick: (e) => {
                const multi = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
                editor.selectLayer(layer.id, multi);
            },
            onTap: () => editor.selectLayer(layer.id),
            onDragMove: (e) => handleDragMove(layer, e.target),
            onDragEnd: (e) => handleDragEnd(layer, e.target),
            onTransformEnd: (e) => handleTransformEnd(layer, e.target),
        };
        switch (layer.type) {
            case "text": {
                const tl = layer;
                return (_jsx(Text, { ...commonProps, text: tl.text, fontSize: tl.fontSize, fontFamily: tl.fontFamily ?? "Inter", fontStyle: `${tl.fontWeight ?? 400} ${tl.fontStyle ?? "normal"}`, fill: tl.fill ?? "#000000", align: tl.align ?? "left", verticalAlign: tl.verticalAlign ?? "top", lineHeight: tl.lineHeight ?? 1.2, letterSpacing: tl.letterSpacing ?? 0 }, layer.id));
            }
            case "shape": {
                const sl = layer;
                if (sl.shapeType === "circle") {
                    return (_jsx(Rect, { ...commonProps, fill: sl.fill ?? "#e0e0e0", stroke: sl.stroke ?? "#333", strokeWidth: sl.strokeWidth ?? 2, cornerRadius: Math.min(sl.width, sl.height) / 2 }, layer.id));
                }
                return (_jsx(Rect, { ...commonProps, fill: sl.fill ?? "#e0e0e0", stroke: sl.stroke ?? "#333", strokeWidth: sl.strokeWidth ?? 2, cornerRadius: sl.cornerRadius ?? 0 }, layer.id));
            }
            case "image": {
                const il = layer;
                const img = loadedImages[il.id];
                if (img) {
                    return (_jsx(KonvaImage, { ...commonProps, image: img }, layer.id));
                }
                // Placeholder for image without source
                return (_jsxs(Group, { ...commonProps, children: [_jsx(Rect, { width: layer.width, height: layer.height, fill: "#f0f0f0", stroke: "#ccc", strokeWidth: 1, dash: [6, 4] }), _jsx(Text, { width: layer.width, height: layer.height, text: "\uD83D\uDDBC", fontSize: Math.min(layer.width, layer.height) * 0.3, align: "center", verticalAlign: "middle", fill: "#999" })] }, layer.id));
            }
            default:
                return null;
        }
    };
    return (_jsxs(Stage, { ref: stageRef, width: stageWidth, height: stageHeight, onClick: handleStageClick, onTap: handleStageClick, children: [_jsx(Layer, { children: _jsxs(Group, { x: offsetX, y: offsetY, scaleX: effectiveScale, scaleY: effectiveScale, children: [_jsx(Rect, { name: "canvas-bg", x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, fill: "#ffffff", shadowColor: "rgba(0,0,0,0.15)", shadowBlur: 20, shadowOffsetY: 4 }), showGrid && (_jsxs(Group, { children: [Array.from({ length: Math.floor(CANVAS_W / GRID_SIZE) + 1 }, (_, i) => (_jsx(Line, { points: [i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_H], stroke: "#e5e7eb", strokeWidth: 0.5 }, `gv${i}`))), Array.from({ length: Math.floor(CANVAS_H / GRID_SIZE) + 1 }, (_, i) => (_jsx(Line, { points: [0, i * GRID_SIZE, CANVAS_W, i * GRID_SIZE], stroke: "#e5e7eb", strokeWidth: 0.5 }, `gh${i}`)))] }))] }) }), _jsx(Layer, { ref: layerRef, children: _jsxs(Group, { x: offsetX, y: offsetY, scaleX: effectiveScale, scaleY: effectiveScale, children: [layers.map(renderLayer), snapLines.map((line, i) => line.orientation === "vertical" ? (_jsx(Line, { points: [line.position, 0, line.position, CANVAS_H], stroke: "#4f6ef7", strokeWidth: 1, dash: [4, 4] }, `snap-${i}`)) : (_jsx(Line, { points: [0, line.position, CANVAS_W, line.position], stroke: "#4f6ef7", strokeWidth: 1, dash: [4, 4] }, `snap-${i}`))), _jsx(Transformer, { ref: transformerRef, rotateEnabled: true, keepRatio: false, enabledAnchors: [
                                "top-left",
                                "top-center",
                                "top-right",
                                "middle-left",
                                "middle-right",
                                "bottom-left",
                                "bottom-center",
                                "bottom-right",
                            ], borderStroke: "#4f6ef7", borderStrokeWidth: 1.5, anchorStroke: "#4f6ef7", anchorFill: "#ffffff", anchorSize: 8, anchorCornerRadius: 2, rotateAnchorOffset: 24, boundBoxFunc: (oldBox, newBox) => {
                                if (newBox.width < 10 || newBox.height < 10)
                                    return oldBox;
                                return newBox;
                            } })] }) })] }));
};
