import { renderLabelDocument } from "./renderer.js";

/** The first schema for editable label documents. */
export const LABEL_DOCUMENT_SCHEMA_VERSION = 1 as const;

export interface LabelDocumentSize {
  readonly width: number;
  readonly height: number;
}

export interface LabelTextElement {
  readonly id: string;
  readonly type: "text";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text: string;
  readonly fontSize?: number;
  readonly fill?: string;
  readonly fontFamily?: string;
  readonly fontWeight?: number;
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
}

export interface LabelRectangleElement {
  readonly id: string;
  readonly type: "rectangle";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly rx?: number;
  readonly ry?: number;
}

export interface LabelImageElement {
  readonly id: string;
  readonly type: "image";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly source: string;
  readonly alt?: string;
  /** Keep the whole image visible, or fill the frame with a centered crop. */
  readonly fit?: "contain" | "cover";
  /** Quarter-turn rotation applied around the image frame's center. */
  readonly rotation?: 0 | 90 | 180 | 270;
}

export type LabelElement = LabelTextElement | LabelRectangleElement | LabelImageElement;

export interface LabelDocument {
  readonly schemaVersion: typeof LABEL_DOCUMENT_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly size: LabelDocumentSize;
  readonly elements: readonly LabelElement[];
}

export type NewLabelDocument = Omit<LabelDocument, "revision" | "schemaVersion" | "elements"> & {
  readonly revision?: number;
  readonly schemaVersion?: typeof LABEL_DOCUMENT_SCHEMA_VERSION;
  readonly elements?: readonly LabelElement[];
};

export interface CreateDocumentCommand {
  readonly type: "create-document";
  readonly document?: NewLabelDocument;
  readonly documentId?: string;
  readonly name?: string;
  readonly size?: LabelDocumentSize;
}

export interface RenameDocumentCommand {
  readonly type: "rename-document";
  readonly documentId: string;
  readonly name: string;
}

export interface AddTextCommand {
  readonly type: "add-text";
  readonly documentId: string;
  readonly element?: Partial<LabelTextElement> & { readonly id: string };
  readonly elementId?: string;
  readonly text?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly fontSize?: number;
  readonly fill?: string;
  readonly fontFamily?: string;
  readonly fontWeight?: number;
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
}

export interface UpdateTextCommand {
  readonly type: "update-text";
  readonly documentId: string;
  readonly elementId: string;
  readonly text?: string;
  readonly updates?: Partial<Pick<LabelTextElement, "text" | "fontSize" | "fill" | "fontFamily" | "fontWeight" | "lineHeight" | "letterSpacing">>;
  readonly patch?: Partial<Pick<LabelTextElement, "text" | "fontSize" | "fill" | "fontFamily" | "fontWeight" | "lineHeight" | "letterSpacing">>;
}

export interface MoveElementCommand {
  readonly type: "move-element";
  readonly documentId: string;
  readonly elementId: string;
  /** Set an element's absolute position. */
  readonly x?: number;
  readonly y?: number;
  /** Move an element by a delta. Use this form when x/y are omitted. */
  readonly dx?: number;
  readonly dy?: number;
}

export interface ResizeElementCommand {
  readonly type: "resize-element";
  readonly documentId: string;
  readonly elementId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RemoveElementCommand {
  readonly type: "remove-element";
  readonly documentId: string;
  readonly elementId: string;
}

export interface AddRectangleCommand {
  readonly type: "add-rectangle";
  readonly documentId: string;
  readonly element?: Partial<LabelRectangleElement> & { readonly id: string };
  readonly elementId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly rx?: number;
  readonly ry?: number;
}

export interface AddImageCommand {
  readonly type: "add-image";
  readonly documentId: string;
  readonly element?: Partial<LabelImageElement> & { readonly id: string };
  readonly elementId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly source?: string;
  readonly alt?: string;
  readonly fit?: "contain" | "cover";
  readonly rotation?: 0 | 90 | 180 | 270;
}

export interface UpdateImageCommand {
  readonly type: "update-image";
  readonly documentId: string;
  readonly elementId: string;
  readonly fit?: "contain" | "cover";
  readonly rotation?: 0 | 90 | 180 | 270;
}

export interface DuplicateElementCommand {
  readonly type: "duplicate-element";
  readonly documentId: string;
  readonly elementId: string;
  readonly newElementId: string;
  readonly dx?: number;
  readonly dy?: number;
}

export type WorkspaceCommand =
  | CreateDocumentCommand
  | RenameDocumentCommand
  | AddTextCommand
  | UpdateTextCommand
  | MoveElementCommand
  | ResizeElementCommand
  | RemoveElementCommand
  | AddRectangleCommand
  | AddImageCommand
  | UpdateImageCommand
  | DuplicateElementCommand;

export interface WorkspaceChange {
  readonly type: WorkspaceCommand["type"];
  readonly command: WorkspaceCommand;
  readonly documentId: string;
  readonly document: LabelDocument;
  readonly previousDocument?: LabelDocument;
}

export interface LabelWorkspace {
  listDocuments(): readonly LabelDocument[];
  getDocument(id: string): LabelDocument | undefined;
  execute(command: WorkspaceCommand): WorkspaceChange;
  render(documentId: string): import("./renderer.js").RenderArtifact;
}

export class WorkspaceError extends Error {
  readonly code: "invalid-command" | "invalid-document" | "document-not-found" | "element-not-found" | "duplicate-id";

  constructor(
    code: WorkspaceError["code"],
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

function fail(code: WorkspaceError["code"], message: string): never {
  throw new WorkspaceError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("invalid-document", `${label} must be a non-empty string`);
  }
  return value;
}

function requireFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("invalid-document", `${label} must be finite`);
  }
  return value;
}

function requirePositive(value: unknown, label: string): number {
  const finite = requireFinite(value, label);
  if (finite <= 0) fail("invalid-document", `${label} must be positive`);
  return finite;
}

function requireNonNegativeFinite(value: unknown, label: string): number {
  const finite = requireFinite(value, label);
  if (finite < 0) fail("invalid-document", `${label} must not be negative`);
  return finite;
}

function requireRasterDataUrl(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    fail("invalid-document", `${label} must be a PNG, JPEG, or WebP base64 data URL`);
  }
  return value;
}

function requireImageFit(value: unknown, label: string): "contain" | "cover" {
  if (value !== "contain" && value !== "cover") {
    fail("invalid-document", `${label} must be contain or cover`);
  }
  return value;
}

function requireImageRotation(value: unknown, label: string): 0 | 90 | 180 | 270 {
  if (value !== 0 && value !== 90 && value !== 180 && value !== 270) {
    fail("invalid-document", `${label} must be 0, 90, 180, or 270`);
  }
  return value;
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (!isRecord(value)) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) copy[key] = clone(child);
  return copy as T;
}

function freeze<T>(value: T): T {
  if (!isRecord(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  return Object.freeze(value);
}

function freezeClone<T>(value: T): T {
  return freeze(clone(value));
}

function validateElement(value: unknown, index: number): LabelElement {
  if (!isRecord(value)) fail("invalid-document", `elements[${index}] must be an object`);
  const id = requireString(value.id, `elements[${index}].id`);
  const type = value.type;
  if (type !== "text" && type !== "rectangle" && type !== "image") {
    fail("invalid-document", `elements[${index}].type must be text, rectangle, or image`);
  }
  const base = {
    id,
    type,
    x: requireFinite(value.x, `elements[${index}].x`),
    y: requireFinite(value.y, `elements[${index}].y`),
    width: requirePositive(value.width, `elements[${index}].width`),
    height: requirePositive(value.height, `elements[${index}].height`),
  };
  if (type === "text") {
    const text = typeof value.text === "string" ? value.text : fail("invalid-document", `elements[${index}].text must be a string`);
    const element: LabelTextElement = {
      ...base,
      type,
      text,
      ...(value.fontSize === undefined ? {} : { fontSize: requirePositive(value.fontSize, `elements[${index}].fontSize`) }),
      ...(value.fill === undefined ? {} : { fill: requireString(value.fill, `elements[${index}].fill`) }),
      ...(value.fontFamily === undefined ? {} : { fontFamily: requireString(value.fontFamily, `elements[${index}].fontFamily`) }),
      ...(value.fontWeight === undefined ? {} : { fontWeight: requirePositive(value.fontWeight, `elements[${index}].fontWeight`) }),
      ...(value.lineHeight === undefined ? {} : { lineHeight: requirePositive(value.lineHeight, `elements[${index}].lineHeight`) }),
      ...(value.letterSpacing === undefined ? {} : { letterSpacing: requireFinite(value.letterSpacing, `elements[${index}].letterSpacing`) }),
    };
    return element;
  }
  if (type === "image") {
    const image: LabelImageElement = {
      ...base,
      type,
      source: requireRasterDataUrl(value.source, `elements[${index}].source`),
      ...(value.alt === undefined ? {} : { alt: typeof value.alt === "string" ? value.alt : fail("invalid-document", `elements[${index}].alt must be a string`) }),
      ...(value.fit === undefined ? {} : { fit: requireImageFit(value.fit, `elements[${index}].fit`) }),
      ...(value.rotation === undefined ? {} : { rotation: requireImageRotation(value.rotation, `elements[${index}].rotation`) }),
    };
    return image;
  }
  const rectangle: LabelRectangleElement = {
    ...base,
    type,
    ...(value.fill === undefined ? {} : { fill: requireString(value.fill, `elements[${index}].fill`) }),
    ...(value.stroke === undefined ? {} : { stroke: requireString(value.stroke, `elements[${index}].stroke`) }),
    ...(value.strokeWidth === undefined ? {} : { strokeWidth: requireNonNegativeFinite(value.strokeWidth, `elements[${index}].strokeWidth`) }),
    ...(value.rx === undefined ? {} : { rx: requireNonNegativeFinite(value.rx, `elements[${index}].rx`) }),
    ...(value.ry === undefined ? {} : { ry: requireNonNegativeFinite(value.ry, `elements[${index}].ry`) }),
  };
  return rectangle;
}

function validateDocument(value: unknown, label = "document"): LabelDocument {
  if (!isRecord(value)) fail("invalid-document", `${label} must be an object`);
  if (value.schemaVersion !== undefined && value.schemaVersion !== LABEL_DOCUMENT_SCHEMA_VERSION) {
    fail("invalid-document", `${label}.schemaVersion must be ${LABEL_DOCUMENT_SCHEMA_VERSION}`);
  }
  const id = requireString(value.id, `${label}.id`);
  const name = requireString(value.name, `${label}.name`);
  if (!isRecord(value.size)) fail("invalid-document", `${label}.size must be an object`);
  const size: LabelDocumentSize = {
    width: requirePositive(value.size.width, `${label}.size.width`),
    height: requirePositive(value.size.height, `${label}.size.height`),
  };
  if (!Array.isArray(value.elements)) fail("invalid-document", `${label}.elements must be an array`);
  const revision = value.revision === undefined ? 0 : value.revision;
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
    fail("invalid-document", `${label}.revision must be a non-negative integer`);
  }
  const elements = value.elements.map(validateElement);
  const ids = new Set<string>();
  for (const element of elements) {
    if (ids.has(element.id)) fail("duplicate-id", `Duplicate element id "${element.id}" in document "${id}"`);
    ids.add(element.id);
  }
  return { schemaVersion: LABEL_DOCUMENT_SCHEMA_VERSION, id, name, revision, size, elements };
}

function documentForCreate(command: CreateDocumentCommand): LabelDocument {
  if (command.document !== undefined) {
    return validateDocument({ ...command.document, elements: command.document.elements ?? [] }, "command.document");
  }
  if (command.documentId === undefined || command.name === undefined || command.size === undefined) {
    fail("invalid-command", "create-document requires document or documentId, name, and size");
  }
  return validateDocument({
    schemaVersion: LABEL_DOCUMENT_SCHEMA_VERSION,
    id: command.documentId,
    name: command.name,
    size: command.size,
    elements: [],
    revision: 0,
  }, "create-document");
}

function updatedDocument(document: LabelDocument, elements: readonly LabelElement[], patch: Partial<LabelDocument> = {}): LabelDocument {
  return validateDocument({
    ...document,
    ...patch,
    revision: document.revision + 1,
    elements,
  });
}

function findElement(document: LabelDocument, elementId: string): LabelElement {
  const element = document.elements.find((candidate) => candidate.id === elementId);
  if (!element) fail("element-not-found", `Element "${elementId}" was not found in document "${document.id}"`);
  return element;
}

function elementId(commandElement: { id?: string }, fallback: string | undefined): string {
  const id = commandElement.id ?? fallback;
  if (id === undefined) fail("invalid-command", "add element requires an id");
  return requireString(id, "element.id");
}

function change(command: WorkspaceCommand, document: LabelDocument, previousDocument?: LabelDocument): WorkspaceChange {
  return freezeClone({
    type: command.type,
    command,
    documentId: document.id,
    document,
    ...(previousDocument === undefined ? {} : { previousDocument }),
  });
}

export function createLabelWorkspace(initialDocuments: readonly NewLabelDocument[] = []): LabelWorkspace {
  const documents = new Map<string, LabelDocument>();
  for (const initial of initialDocuments) {
    const document = freezeClone(validateDocument({ ...initial, elements: initial.elements ?? [] }));
    if (documents.has(document.id)) fail("duplicate-id", `Duplicate document id "${document.id}"`);
    documents.set(document.id, document);
  }

  const getKnownDocument = (id: string): LabelDocument => {
    const document = documents.get(id);
    if (!document) fail("document-not-found", `Document "${id}" was not found`);
    return document;
  };

  const replace = (next: LabelDocument, previous: LabelDocument, command: WorkspaceCommand): WorkspaceChange => {
    const frozen = freezeClone(next);
    documents.set(frozen.id, frozen);
    return change(command, frozen, previous);
  };

  const execute = (command: WorkspaceCommand): WorkspaceChange => {
    if (!isRecord(command) || typeof command.type !== "string") fail("invalid-command", "Workspace command must have a type");
    switch (command.type) {
      case "create-document": {
        const created = documentForCreate(command);
        if (documents.has(created.id)) fail("duplicate-id", `Document id "${created.id}" is already in use`);
        const frozen = freezeClone(created);
        documents.set(frozen.id, frozen);
        return change(command, frozen);
      }
      case "rename-document": {
        const previous = getKnownDocument(command.documentId);
        const name = requireString(command.name, "name");
        return replace(updatedDocument(previous, previous.elements, { name }), previous, command);
      }
      case "add-text": {
        const previous = getKnownDocument(command.documentId);
        const supplied: Partial<LabelTextElement> = command.element ?? {};
        const id = elementId(supplied, command.elementId);
        if (previous.elements.some((element) => element.id === id)) fail("duplicate-id", `Element id "${id}" is already in use in document "${previous.id}"`);
        const element = validateElement({
          id,
          type: "text",
          x: command.x ?? supplied.x ?? 0,
          y: command.y ?? supplied.y ?? 0,
          width: command.width ?? supplied.width ?? 100,
          height: command.height ?? supplied.height ?? 24,
          text: command.text ?? supplied.text ?? "",
          fontSize: command.fontSize ?? supplied.fontSize,
          fill: command.fill ?? supplied.fill,
          fontFamily: command.fontFamily ?? supplied.fontFamily,
          fontWeight: command.fontWeight ?? supplied.fontWeight,
          lineHeight: command.lineHeight ?? supplied.lineHeight,
          letterSpacing: command.letterSpacing ?? supplied.letterSpacing,
        }, previous.elements.length);
        return replace(updatedDocument(previous, [...previous.elements, element]), previous, command);
      }
      case "add-rectangle": {
        const previous = getKnownDocument(command.documentId);
        const supplied: Partial<LabelRectangleElement> = command.element ?? {};
        const id = elementId(supplied, command.elementId);
        if (previous.elements.some((element) => element.id === id)) fail("duplicate-id", `Element id "${id}" is already in use in document "${previous.id}"`);
        const element = validateElement({
          id,
          type: "rectangle",
          x: command.x ?? supplied.x ?? 0,
          y: command.y ?? supplied.y ?? 0,
          width: command.width ?? supplied.width ?? 100,
          height: command.height ?? supplied.height ?? 100,
          fill: command.fill ?? supplied.fill,
          stroke: command.stroke ?? supplied.stroke,
          strokeWidth: command.strokeWidth ?? supplied.strokeWidth,
          rx: command.rx ?? supplied.rx,
          ry: command.ry ?? supplied.ry,
        }, previous.elements.length);
        return replace(updatedDocument(previous, [...previous.elements, element]), previous, command);
      }
      case "add-image": {
        const previous = getKnownDocument(command.documentId);
        const supplied: Partial<LabelImageElement> = command.element ?? {};
        const id = elementId(supplied, command.elementId);
        if (previous.elements.some((element) => element.id === id)) fail("duplicate-id", `Element id "${id}" is already in use in document "${previous.id}"`);
        const element = validateElement({
          id,
          type: "image",
          x: command.x ?? supplied.x ?? 0,
          y: command.y ?? supplied.y ?? 0,
          width: command.width ?? supplied.width ?? 100,
          height: command.height ?? supplied.height ?? 100,
          source: command.source ?? supplied.source,
          alt: command.alt ?? supplied.alt,
          fit: command.fit ?? supplied.fit,
          rotation: command.rotation ?? supplied.rotation,
        }, previous.elements.length);
        return replace(updatedDocument(previous, [...previous.elements, element]), previous, command);
      }
      case "update-image": {
        const previous = getKnownDocument(command.documentId);
        const element = findElement(previous, command.elementId);
        if (element.type !== "image") fail("invalid-command", `Element "${command.elementId}" is not an image element`);
        if (command.fit === undefined && command.rotation === undefined) {
          fail("invalid-command", "update-image requires fit or rotation");
        }
        const nextElements = previous.elements.map((candidate, index) => candidate.id === element.id
          ? validateElement({
              ...candidate,
              ...(command.fit === undefined ? {} : { fit: command.fit }),
              ...(command.rotation === undefined ? {} : { rotation: command.rotation }),
            }, index)
          : candidate);
        return replace(updatedDocument(previous, nextElements), previous, command);
      }
      case "duplicate-element": {
        const previous = getKnownDocument(command.documentId);
        const source = findElement(previous, command.elementId);
        const newElementId = requireString(command.newElementId, "newElementId");
        if (previous.elements.some((element) => element.id === newElementId)) fail("duplicate-id", `Element id "${newElementId}" is already in use in document "${previous.id}"`);
        const dx = command.dx ?? 20;
        const dy = command.dy ?? 20;
        requireFinite(dx, "dx");
        requireFinite(dy, "dy");
        const duplicate = validateElement({ ...source, id: newElementId, x: source.x + dx, y: source.y + dy }, previous.elements.length);
        return replace(updatedDocument(previous, [...previous.elements, duplicate]), previous, command);
      }
      case "update-text": {
        const previous = getKnownDocument(command.documentId);
        const element = findElement(previous, command.elementId);
        if (element.type !== "text") fail("invalid-command", `Element "${command.elementId}" is not a text element`);
        const updates = {
          ...(command.updates ?? command.patch ?? {}),
          ...(command.text === undefined ? {} : { text: command.text }),
        };
        const nextElements = previous.elements.map((candidate) => candidate.id === element.id
          ? validateElement({ ...candidate, ...updates }, previous.elements.indexOf(candidate))
          : candidate);
        return replace(updatedDocument(previous, nextElements), previous, command);
      }
      case "move-element": {
        const previous = getKnownDocument(command.documentId);
        findElement(previous, command.elementId);
        const hasAbsolute = command.x !== undefined || command.y !== undefined;
        if (hasAbsolute && (command.x === undefined || command.y === undefined)) fail("invalid-command", "move-element absolute position requires both x and y");
        const hasDelta = command.dx !== undefined || command.dy !== undefined;
        if (!hasAbsolute && (!hasDelta || command.dx === undefined || command.dy === undefined)) fail("invalid-command", "move-element requires x/y or dx/dy");
        const nextElements = previous.elements.map((candidate) => {
          if (candidate.id !== command.elementId) return candidate;
          const x = hasAbsolute ? command.x! : candidate.x + command.dx!;
          const y = hasAbsolute ? command.y! : candidate.y + command.dy!;
          return validateElement({ ...candidate, x, y }, previous.elements.indexOf(candidate));
        });
        return replace(updatedDocument(previous, nextElements), previous, command);
      }
      case "resize-element": {
        const previous = getKnownDocument(command.documentId);
        findElement(previous, command.elementId);
        const nextElements = previous.elements.map((candidate, index) => candidate.id === command.elementId
          ? validateElement({
              ...candidate,
              x: command.x,
              y: command.y,
              width: command.width,
              height: command.height,
            }, index)
          : candidate);
        return replace(updatedDocument(previous, nextElements), previous, command);
      }
      case "remove-element": {
        const previous = getKnownDocument(command.documentId);
        findElement(previous, command.elementId);
        const nextElements = previous.elements.filter((candidate) => candidate.id !== command.elementId);
        return replace(updatedDocument(previous, nextElements), previous, command);
      }
      default:
        fail("invalid-command", "Unsupported workspace command");
    }
  };

  return {
    listDocuments: () => Object.freeze([...documents.values()]),
    getDocument: (id: string) => documents.get(id),
    execute,
    render: (documentId: string) => {
      const document = getKnownDocument(documentId);
      // The import remains at the module seam so workspace consumers do not need to know the renderer implementation.
      return renderLabelDocument(document);
    },
  };
}
