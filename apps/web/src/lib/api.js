const getApiBase = () => import.meta.env.VITE_API_URL ??
    `${window.location.protocol}//${window.location.hostname}:3001`;
const api = (path, init) => fetch(`${getApiBase()}${path}`, init).then((r) => {
    if (!r.ok)
        throw new Error(`API ${r.status}: ${r.statusText}`);
    return r.json();
});
export const fetchTemplates = async (category = "all") => {
    const data = await api(`/templates?category=${category}`);
    return data.templates ?? [];
};
export const renderTemplate = async (templateId, overrides = {}, imageTransforms = {}) => {
    return api(`/templates/${templateId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides, imageTransforms }),
    });
};
export const applyTemplate = async (templateId, overrides) => {
    return api(`/templates/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
    });
};
export const saveTemplate = async (template) => {
    return api("/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
    });
};
export const requestPrint = async (templateId, overrides = {}) => {
    return api(`/print/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, overrides }),
    });
};
export const renderCanvasImage = async (pngDataUrl) => {
    return api("/render/from-canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pngDataUrl }),
    });
};
