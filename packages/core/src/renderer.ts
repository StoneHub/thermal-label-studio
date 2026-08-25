import type { LabelDocument, LabelElement, LabelImageElement, LabelRectangleElement, LabelTextElement } from "./workspace.js";

export interface RenderArtifact {
  readonly documentId: string;
  readonly revision: number;
  readonly width: number;
  readonly height: number;
  readonly mimeType: "image/svg+xml";
  readonly source: string;
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

function textElement(element: LabelTextElement): string {
  const attrs = [
    ...elementAttributes(element),
    attribute("x", element.x),
    attribute("y", element.y),
    attribute("width", element.width),
    attribute("height", element.height),
    ...(element.fontSize === undefined ? [] : [attribute("font-size", element.fontSize)]),
    ...(element.fill === undefined ? [] : [attribute("fill", element.fill)]),
    ...(element.fontFamily === undefined ? [] : [attribute("font-family", element.fontFamily)]),
    ...(element.fontWeight === undefined ? [] : [attribute("font-weight", element.fontWeight)]),
  ].join("");
  return `<text${attrs}>${escapeXml(element.text)}</text>`;
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
  const attrs = [
    ...elementAttributes(element),
    attribute("x", element.x),
    attribute("y", element.y),
    attribute("width", element.width),
    attribute("height", element.height),
    attribute("href", element.source),
    attribute("preserveAspectRatio", "xMidYMid meet"),
    ...(element.alt === undefined ? [] : [attribute("aria-label", element.alt)]),
  ].join("");
  return `<image${attrs}/>`;
}

function renderElement(element: LabelElement): string {
  if (element.type === "text") return textElement(element);
  if (element.type === "rectangle") return rectangleElement(element);
  return imageElement(element);
}

export function renderLabelDocument(document: LabelDocument): RenderArtifact {
  const { width, height } = document.size;
  const source = [
    `<svg xmlns="http://www.w3.org/2000/svg"${attribute("width", width)}${attribute("height", height)}${attribute("viewBox", `0 0 ${width} ${height}`)}>`,
    ...document.elements.map(renderElement),
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
