import React, { useRef, useEffect, useCallback, useState } from "react";
import { Stage, Layer, Rect, Text, Transformer, Line, Group, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { LabelLayer, LabelTextLayer, LabelShapeLayer, LabelImageLayer, SnapLine } from "@tls/core";
import { computeSnapLines } from "@tls/core";
import type { EditorApi } from "../hooks/useEditorState";

interface Props {
  editor: EditorApi;
  containerWidth: number;
  containerHeight: number;
}

const CANVAS_W = 800;
const CANVAS_H = 1200;

// Grid pattern spacing
const GRID_SIZE = 25;

export const EditorCanvas: React.FC<Props> = ({ editor, containerWidth, containerHeight }) => {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});

  const { template, layers, selectedLayerIds, zoom, snapEnabled, showGrid } = editor;

  // Calculate scale to fit canvas in container
  const padding = 40;
  const scaleToFit = Math.min(
    (containerWidth - padding * 2) / CANVAS_W,
    (containerHeight - padding * 2) / CANVAS_H,
    1
  );
  const effectiveScale = scaleToFit * zoom;
  const stageWidth = containerWidth;
  const stageHeight = containerHeight;
  const offsetX = (stageWidth - CANVAS_W * effectiveScale) / 2;
  const offsetY = (stageHeight - CANVAS_H * effectiveScale) / 2;

  // Update transformer when selection changes
  useEffect(() => {
    const transformer = transformerRef.current;
    const layer = layerRef.current;
    if (!transformer || !layer) return;

    const nodes = selectedLayerIds
      .map((id) => layer.findOne(`#${id}`))
      .filter((n): n is Konva.Node => n != null);

    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedLayerIds, layers]);

  // Load images for image layers
  useEffect(() => {
    const imageLayers = layers.filter((l): l is LabelImageLayer => l.type === "image" && !!l.source);
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

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === stageRef.current || e.target.name() === "canvas-bg") {
        editor.deselectAll();
      }
    },
    [editor]
  );

  const handleDragMove = useCallback(
    (layer: LabelLayer, node: Konva.Node) => {
      if (!snapEnabled) return;
      const moving = { ...layer, x: node.x(), y: node.y() };
      const result = computeSnapLines(
        moving,
        layers.filter((l) => l.id !== layer.id),
        CANVAS_W,
        CANVAS_H
      );
      if (result.snappedX !== null) node.x(result.snappedX);
      if (result.snappedY !== null) node.y(result.snappedY);
      setSnapLines(result.lines);
    },
    [layers, snapEnabled]
  );

  const handleDragEnd = useCallback(
    (layer: LabelLayer, node: Konva.Node) => {
      setSnapLines([]);
      editor.moveLayer(layer.id, Math.round(node.x()), Math.round(node.y()));
    },
    [editor]
  );

  const handleTransformEnd = useCallback(
    (layer: LabelLayer, node: Konva.Node) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      // Reset scale and apply to width/height
      node.scaleX(1);
      node.scaleY(1);
      editor.resizeLayer(
        layer.id,
        Math.round(Math.max(10, node.width() * scaleX)),
        Math.round(Math.max(10, node.height() * scaleY)),
        Math.round(node.x()),
        Math.round(node.y())
      );
      editor.rotateLayer(layer.id, Math.round(node.rotation()));
    },
    [editor]
  );

  const renderLayer = (layer: LabelLayer) => {
    if (layer.visible === false) return null;
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
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
        const multi = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
        editor.selectLayer(layer.id, multi);
      },
      onTap: () => editor.selectLayer(layer.id),
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => handleDragMove(layer, e.target),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(layer, e.target),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(layer, e.target),
    };

    switch (layer.type) {
      case "text": {
        const tl = layer as LabelTextLayer;
        return (
          <Text
            key={layer.id}
            {...commonProps}
            text={tl.text}
            fontSize={tl.fontSize}
            fontFamily={tl.fontFamily ?? "Inter"}
            fontStyle={`${tl.fontWeight ?? 400} ${tl.fontStyle ?? "normal"}`}
            fill={tl.fill ?? "#000000"}
            align={tl.align ?? "left"}
            verticalAlign={tl.verticalAlign ?? "top"}
            lineHeight={tl.lineHeight ?? 1.2}
            letterSpacing={tl.letterSpacing ?? 0}
          />
        );
      }
      case "shape": {
        const sl = layer as LabelShapeLayer;
        if (sl.shapeType === "circle") {
          return (
            <Rect
              key={layer.id}
              {...commonProps}
              fill={sl.fill ?? "#e0e0e0"}
              stroke={sl.stroke ?? "#333"}
              strokeWidth={sl.strokeWidth ?? 2}
              cornerRadius={Math.min(sl.width, sl.height) / 2}
            />
          );
        }
        return (
          <Rect
            key={layer.id}
            {...commonProps}
            fill={sl.fill ?? "#e0e0e0"}
            stroke={sl.stroke ?? "#333"}
            strokeWidth={sl.strokeWidth ?? 2}
            cornerRadius={sl.cornerRadius ?? 0}
          />
        );
      }
      case "image": {
        const il = layer as LabelImageLayer;
        const img = loadedImages[il.id];
        if (img) {
          return (
            <KonvaImage
              key={layer.id}
              {...commonProps}
              image={img}
            />
          );
        }
        // Placeholder for image without source
        return (
          <Group key={layer.id} {...commonProps}>
            <Rect
              width={layer.width}
              height={layer.height}
              fill="#f0f0f0"
              stroke="#ccc"
              strokeWidth={1}
              dash={[6, 4]}
            />
            <Text
              width={layer.width}
              height={layer.height}
              text="🖼"
              fontSize={Math.min(layer.width, layer.height) * 0.3}
              align="center"
              verticalAlign="middle"
              fill="#999"
            />
          </Group>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Stage
      ref={stageRef}
      width={stageWidth}
      height={stageHeight}
      onClick={handleStageClick}
      onTap={handleStageClick}
    >
      <Layer>
        {/* Offset group for centering */}
        <Group x={offsetX} y={offsetY} scaleX={effectiveScale} scaleY={effectiveScale}>
          {/* Canvas background */}
          <Rect
            name="canvas-bg"
            x={0}
            y={0}
            width={CANVAS_W}
            height={CANVAS_H}
            fill="#ffffff"
            shadowColor="rgba(0,0,0,0.15)"
            shadowBlur={20}
            shadowOffsetY={4}
          />

          {/* Grid */}
          {showGrid && (
            <Group>
              {Array.from({ length: Math.floor(CANVAS_W / GRID_SIZE) + 1 }, (_, i) => (
                <Line
                  key={`gv${i}`}
                  points={[i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_H]}
                  stroke="#e5e7eb"
                  strokeWidth={0.5}
                />
              ))}
              {Array.from({ length: Math.floor(CANVAS_H / GRID_SIZE) + 1 }, (_, i) => (
                <Line
                  key={`gh${i}`}
                  points={[0, i * GRID_SIZE, CANVAS_W, i * GRID_SIZE]}
                  stroke="#e5e7eb"
                  strokeWidth={0.5}
                />
              ))}
            </Group>
          )}
        </Group>
      </Layer>

      {/* Layer content */}
      <Layer ref={layerRef}>
        <Group x={offsetX} y={offsetY} scaleX={effectiveScale} scaleY={effectiveScale}>
          {layers.map(renderLayer)}

          {/* Snap lines */}
          {snapLines.map((line, i) =>
            line.orientation === "vertical" ? (
              <Line
                key={`snap-${i}`}
                points={[line.position, 0, line.position, CANVAS_H]}
                stroke="#4f6ef7"
                strokeWidth={1}
                dash={[4, 4]}
              />
            ) : (
              <Line
                key={`snap-${i}`}
                points={[0, line.position, CANVAS_W, line.position]}
                stroke="#4f6ef7"
                strokeWidth={1}
                dash={[4, 4]}
              />
            )
          )}

          {/* Transformer */}
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            keepRatio={false}
            enabledAnchors={[
              "top-left",
              "top-center",
              "top-right",
              "middle-left",
              "middle-right",
              "bottom-left",
              "bottom-center",
              "bottom-right",
            ]}
            borderStroke="#4f6ef7"
            borderStrokeWidth={1.5}
            anchorStroke="#4f6ef7"
            anchorFill="#ffffff"
            anchorSize={8}
            anchorCornerRadius={2}
            rotateAnchorOffset={24}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox;
              return newBox;
            }}
          />
        </Group>
      </Layer>
    </Stage>
  );
};
