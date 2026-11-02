import type { LabelDocument, LabelElement, LabelImageElement, LabelRectangleElement, LabelTextElement } from "./workspace.js";
import { measureLabelText, wrapLabelText, type LabelTextMeasure } from "./textWrap.js";

export interface RenderArtifact {
  readonly documentId: string;
  readonly revision: number;
  readonly width: number;
  readonly height: number;
  readonly mimeType: "image/svg+xml";
  readonly source: string;
}

export interface RenderOptions {
  readonly measureText?: LabelTextMeasure;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function attribute(name: string, value: string | number): string {
  return ` ${name}="${escapeXml(String(value))}"`;
}

function elementAttributes(element: LabelElement): string[] {
  return [attribute("data-element-id", element.id), attribute("id", element.id)];
}

function textElement(element: LabelTextElement, measureText: LabelTextMeasure): string {
  const fontSize = element.fontSize ?? 24;
  const fontWeight = element.fontWeight ?? 400;
  const letterSpacing = element.letterSpacing ?? 0;
  const lineHeight = element.lineHeight ?? 1.2;
  const fontFamily = element.fontFamily ?? "Arial, sans-serif";
  const lines = wrapLabelText(element.text, element.width, fontSize, fontWeight, letterSpacing, fontFamily, measureText);
  const attrs = [
    ...elementAttributes(element),
    attribute("x", element.x),
    attribute("y", element.y),
    attribute("width", element.width),
    attribute("height", element.height),
    attribute("font-size", fontSize),
    ...(element.fill === undefined ? [] : [attribute("fill", element.fill)]),
    attribute("font-family", fontFamily),
    attribute("font-weight", fontWeight),
    ...(letterSpacing === 0 ? [] : [attribute("letter-spacing", letterSpacing)]),
  ].join("");
  const tspans = lines.map((line, index) => (
    `<tspan${attribute("x", element.x)}${attribute("y", element.y + fontSize + index * fontSize * lineHeight)}>${escapeXml(line)}</tspan>`
  )).join("");
  return `<text${attrs}>${tspans}</text>`;
}

function rectangleElement(element: LabelRectangleElement): string {
  const attrs = [
    ...elementAttributes(element),
    attribute("x", element.x),
    attribute("y", element.y),
    attribute("width", element.width),
    attribute("height", element.height),
    ...(element.fill === undefined ? [] : [attribute("fill", element.fill)]),
    ...(element.stroke === undefined ? [] : [attribute("stroke", element.stroke)]),
    ...(element.strokeWidth === undefined ? [] : [attribute("stroke-width", element.strokeWidth)]),
    ...(element.rx === undefined ? [] : [attribute("rx", element.rx)]),
    ...(element.ry === undefined ? [] : [attribute("ry", element.ry)]),
  ].join("");
  return `<rect${attrs}/>`;
}

function imageElement(element: LabelImageElement): string {
  const rotation = element.rotation ?? 0;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const attrs = [
    ...elementAttributes(element),
    attribute("x", element.x),
    attribute("y", element.y),
    attribute("width", element.width),
    attribute("height", element.height),
    attribute("href", element.source),
    attribute("preserveAspectRatio", element.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"),
    ...(element.alt === undefined ? [] : [attribute("aria-label", element.alt)]),
  ].join("");
  const image = `<image${attrs}/>`;
  return rotation === 0 ? image : `<g${attribute("transform", `rotate(${rotation} ${centerX} ${centerY})`)}>${image}</g>`;
}

function renderElement(element: LabelElement, measureText: LabelTextMeasure): string {
  if (element.type === "text") return textElement(element, measureText);
  if (element.type === "rectangle") return rectangleElement(element);
  return imageElement(element);
}

export function renderLabelDocument(document: LabelDocument, options: RenderOptions = {}): RenderArtifact {
  const { width, height } = document.size;
  const measureText = options.measureText ?? measureLabelText;
  const source = [
    `<svg xmlns="http://www.w3.org/2000/svg"${attribute("width", width)}${attribute("height", height)}${attribute("viewBox", `0 0 ${width} ${height}`)}>`,
    ...document.elements.map((element) => renderElement(element, measureText)),
    "</svg>",
  ].join("");
  return Object.freeze({
    documentId: document.id,
    revision: document.revision,
    width,
    height,
    mimeType: "image/svg+xml" as const,
    source,
  });
}
