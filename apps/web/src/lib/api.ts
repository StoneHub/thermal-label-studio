import type { LabelTemplate, LabelCategory } from "@tls/core";

export type TemplateSummary = LabelTemplate & {
  category: LabelCategory;
  placeholders: string[];
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_URL as string | undefined) ??
  `${window.location.protocol}//${window.location.hostname}:3001`;

const api = (path: string, init?: RequestInit) =>
  fetch(`${getApiBase()}${path}`, init).then((r) => {
    if (!r.ok) throw new Error(`API ${r.status}: ${r.statusText}`);
    return r.json();
  });

export const fetchTemplates = async (
  category: "all" | LabelCategory = "all"
): Promise<TemplateSummary[]> => {
  const data = await api(`/templates?category=${category}`);
  return data.templates ?? [];
};

export const renderTemplate = async (
  templateId: string,
  overrides: Record<string, string> = {},
  imageTransforms: Record<string, { x: number; y: number; scale: number }> = {}
): Promise<{ width: number; height: number; pngBase64: string }> => {
  return api(`/templates/${templateId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides, imageTransforms }),
  });
};

export const applyTemplate = async (
  templateId: string,
  overrides: Record<string, string>
): Promise<{ template: LabelTemplate }> => {
  return api(`/templates/${templateId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides }),
  });
};

export const saveTemplate = async (template: LabelTemplate): Promise<{ ok: boolean; id: string }> => {
  return api("/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template }),
  });
};

export const requestPrint = async (
  templateId: string,
  overrides: Record<string, string> = {}
): Promise<{ jobId: string; status: string }> => {
  return api(`/print/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, overrides }),
  });
};

export const renderCanvasImage = async (
  pngDataUrl: string
): Promise<{ width: number; height: number; pngBase64: string }> => {
  return api("/render/from-canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pngDataUrl }),
  });
};
