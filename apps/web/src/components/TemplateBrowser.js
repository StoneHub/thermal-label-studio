import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { CANVAS_TARGET } from "@tls/core";
import { fetchTemplates } from "../lib/api";
// Built-in starter templates for offline / fallback use
const STARTER_TEMPLATES = [
    {
        id: "blank-full",
        name: "Blank 4x6 Label",
        description: "Empty full-size thermal label",
        category: "full",
        size: { width: CANVAS_TARGET.width, height: CANVAS_TARGET.height, unit: "px" },
        layers: [],
    },
    {
        id: "blank-sticker",
        name: "Blank Sticker Sheet",
        description: "6-up sticker layout on 4x6",
        category: "sticker",
        size: { width: CANVAS_TARGET.width, height: CANVAS_TARGET.height, unit: "px" },
        layers: [
            // 2x3 grid of sticker backgrounds
            { id: "s1", type: "shape", shapeType: "rect", x: 10, y: 10, width: 385, height: 390, fill: "#f8f8f8", stroke: "#ddd", strokeWidth: 1, cornerRadius: 12 },
            { id: "s2", type: "shape", shapeType: "rect", x: 405, y: 10, width: 385, height: 390, fill: "#f8f8f8", stroke: "#ddd", strokeWidth: 1, cornerRadius: 12 },
            { id: "s3", type: "shape", shapeType: "rect", x: 10, y: 410, width: 385, height: 390, fill: "#f8f8f8", stroke: "#ddd", strokeWidth: 1, cornerRadius: 12 },
            { id: "s4", type: "shape", shapeType: "rect", x: 405, y: 410, width: 385, height: 390, fill: "#f8f8f8", stroke: "#ddd", strokeWidth: 1, cornerRadius: 12 },
            { id: "s5", type: "shape", shapeType: "rect", x: 10, y: 810, width: 385, height: 380, fill: "#f8f8f8", stroke: "#ddd", strokeWidth: 1, cornerRadius: 12 },
            { id: "s6", type: "shape", shapeType: "rect", x: 405, y: 810, width: 385, height: 380, fill: "#f8f8f8", stroke: "#ddd", strokeWidth: 1, cornerRadius: 12 },
        ],
    },
    {
        id: "shipping-label",
        name: "Shipping Label",
        description: "Standard shipping label with address fields",
        category: "full",
        tags: ["shipping", "mail"],
        size: { width: 800, height: 1200, unit: "px" },
        layers: [
            { id: "bg", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 1200, fill: "#ffffff", stroke: "#000000", strokeWidth: 3, cornerRadius: 0 },
            { id: "header-bg", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 120, fill: "#1a1a2e", stroke: "transparent", strokeWidth: 0, cornerRadius: 0 },
            { id: "header", type: "text", x: 30, y: 30, width: 740, height: 60, text: "SHIP TO", fontSize: 48, fontFamily: "Arial", fontWeight: 700, fill: "#ffffff", align: "center" },
            { id: "divider", type: "shape", shapeType: "rect", x: 30, y: 140, width: 740, height: 3, fill: "#e0e0e0", stroke: "transparent", strokeWidth: 0, cornerRadius: 0 },
            { id: "name", type: "text", x: 40, y: 170, width: 720, height: 50, text: "Recipient Name", fontSize: 36, fontFamily: "Arial", fontWeight: 700, fill: "#000000" },
            { id: "address1", type: "text", x: 40, y: 240, width: 720, height: 40, text: "123 Main Street", fontSize: 28, fontFamily: "Arial", fill: "#333333" },
            { id: "address2", type: "text", x: 40, y: 290, width: 720, height: 40, text: "City, State ZIP", fontSize: 28, fontFamily: "Arial", fill: "#333333" },
            { id: "barcode-area", type: "shape", shapeType: "rect", x: 40, y: 900, width: 720, height: 250, fill: "#f5f5f5", stroke: "#ccc", strokeWidth: 1, cornerRadius: 8 },
            { id: "barcode-label", type: "text", x: 40, y: 1160, width: 720, height: 30, text: "TRACKING: 1Z999AA10123456784", fontSize: 18, fontFamily: "Courier New", fill: "#666666", align: "center" },
        ],
    },
    {
        id: "drawer-label",
        name: "Drawer Label",
        description: "Simple label for organizing drawers",
        category: "full",
        tags: ["organization", "home"],
        size: { width: 800, height: 1200, unit: "px" },
        layers: [
            { id: "bg", type: "shape", shapeType: "rect", x: 20, y: 20, width: 760, height: 1160, fill: "#fefce8", stroke: "#ca8a04", strokeWidth: 3, cornerRadius: 24 },
            { id: "icon-area", type: "shape", shapeType: "rect", x: 200, y: 100, width: 400, height: 400, fill: "#fef9c3", stroke: "#eab308", strokeWidth: 2, cornerRadius: 200 },
            { id: "icon-text", type: "text", x: 200, y: 200, width: 400, height: 200, text: "🧦", fontSize: 120, align: "center", verticalAlign: "middle", fill: "#000000" },
            { id: "title", type: "text", x: 60, y: 560, width: 680, height: 80, text: "Socks", fontSize: 64, fontFamily: "Arial", fontWeight: 700, align: "center", fill: "#713f12" },
            { id: "subtitle", type: "text", x: 60, y: 660, width: 680, height: 50, text: "Dresser - Top Drawer", fontSize: 28, fontFamily: "Arial", align: "center", fill: "#a16207" },
        ],
    },
    {
        id: "craft-supply-label",
        name: "Craft Supply Bin",
        description: "Label for organizing craft supplies",
        category: "full",
        tags: ["craft", "organization"],
        size: { width: 800, height: 1200, unit: "px" },
        layers: [
            { id: "bg", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 1200, fill: "#fdf2f8", stroke: "#db2777", strokeWidth: 4, cornerRadius: 20 },
            { id: "banner", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 200, fill: "#db2777", stroke: "transparent", strokeWidth: 0, cornerRadius: 0 },
            { id: "banner-text", type: "text", x: 30, y: 50, width: 740, height: 100, text: "CRAFT SUPPLIES", fontSize: 48, fontFamily: "Arial", fontWeight: 800, fill: "#ffffff", align: "center" },
            { id: "item-title", type: "text", x: 60, y: 280, width: 680, height: 80, text: "Washi Tape", fontSize: 56, fontFamily: "Georgia", fontWeight: 700, fill: "#831843", align: "center" },
            { id: "desc", type: "text", x: 80, y: 400, width: 640, height: 200, text: "Decorative tapes\nPatterns & solids\nVarious widths", fontSize: 28, fontFamily: "Arial", fill: "#9d174d", lineHeight: 1.6 },
            { id: "decor", type: "text", x: 200, y: 700, width: 400, height: 300, text: "✂️🎨🧵", fontSize: 80, align: "center", fill: "#000000" },
        ],
    },
    {
        id: "storage-box-label",
        name: "Storage Box Label",
        description: "For attic/basement storage boxes",
        category: "full",
        tags: ["storage", "organization"],
        size: { width: 800, height: 1200, unit: "px" },
        layers: [
            { id: "bg", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 1200, fill: "#eff6ff", stroke: "#2563eb", strokeWidth: 4, cornerRadius: 16 },
            { id: "header", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 160, fill: "#2563eb", stroke: "transparent", strokeWidth: 0, cornerRadius: 0 },
            { id: "box-num", type: "text", x: 30, y: 30, width: 740, height: 100, text: "BOX #1", fontSize: 64, fontFamily: "Arial", fontWeight: 800, fill: "#ffffff", align: "center" },
            { id: "location", type: "text", x: 40, y: 190, width: 720, height: 50, text: "📍 Attic - North Wall", fontSize: 28, fontFamily: "Arial", fontWeight: 600, fill: "#1e40af" },
            { id: "contents-header", type: "text", x: 40, y: 270, width: 720, height: 40, text: "CONTENTS:", fontSize: 22, fontFamily: "Arial", fontWeight: 700, fill: "#3b82f6" },
            { id: "contents", type: "text", x: 40, y: 320, width: 720, height: 500, text: "• Holiday decorations\n• String lights\n• Ornaments\n• Wreaths", fontSize: 30, fontFamily: "Arial", fill: "#1e3a5f", lineHeight: 1.8 },
            { id: "date", type: "text", x: 40, y: 1100, width: 720, height: 40, text: "Packed: March 2026", fontSize: 22, fontFamily: "Arial", fill: "#6b7280", align: "right" },
        ],
    },
    {
        id: "feeding-chart",
        name: "Feeding Chart",
        description: "Baby/pet feeding schedule",
        category: "full",
        tags: ["baby", "pet", "schedule"],
        size: { width: 800, height: 1200, unit: "px" },
        layers: [
            { id: "bg", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 1200, fill: "#f0fdf4", stroke: "#16a34a", strokeWidth: 3, cornerRadius: 16 },
            { id: "header-bg", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 140, fill: "#16a34a", stroke: "transparent", strokeWidth: 0, cornerRadius: 0 },
            { id: "header", type: "text", x: 30, y: 30, width: 740, height: 80, text: "🍼 Feeding Schedule", fontSize: 44, fontFamily: "Arial", fontWeight: 700, fill: "#ffffff", align: "center" },
            { id: "name", type: "text", x: 40, y: 170, width: 720, height: 50, text: "Baby's Name", fontSize: 32, fontFamily: "Georgia", fontWeight: 700, fill: "#166534", align: "center" },
            { id: "row1", type: "text", x: 40, y: 260, width: 720, height: 40, text: "6:00 AM  —  Milk (6 oz)", fontSize: 26, fontFamily: "Courier New", fill: "#333333" },
            { id: "row2", type: "text", x: 40, y: 320, width: 720, height: 40, text: "9:00 AM  —  Cereal + Fruit", fontSize: 26, fontFamily: "Courier New", fill: "#333333" },
            { id: "row3", type: "text", x: 40, y: 380, width: 720, height: 40, text: "12:00 PM —  Lunch", fontSize: 26, fontFamily: "Courier New", fill: "#333333" },
            { id: "row4", type: "text", x: 40, y: 440, width: 720, height: 40, text: "3:00 PM  —  Snack + Milk", fontSize: 26, fontFamily: "Courier New", fill: "#333333" },
            { id: "row5", type: "text", x: 40, y: 500, width: 720, height: 40, text: "6:00 PM  —  Dinner", fontSize: 26, fontFamily: "Courier New", fill: "#333333" },
            { id: "row6", type: "text", x: 40, y: 560, width: 720, height: 40, text: "8:00 PM  —  Bedtime Milk", fontSize: 26, fontFamily: "Courier New", fill: "#333333" },
            { id: "notes-header", type: "text", x: 40, y: 660, width: 720, height: 40, text: "Notes:", fontSize: 24, fontFamily: "Arial", fontWeight: 600, fill: "#16a34a" },
            { id: "notes", type: "text", x: 40, y: 710, width: 720, height: 200, text: "Allergies: None\nPrefers warm milk\nNo screen time during meals", fontSize: 22, fontFamily: "Arial", fill: "#555555", lineHeight: 1.6 },
        ],
    },
    {
        id: "instruction-list",
        name: "Instruction List",
        description: "Step-by-step instructions label",
        category: "full",
        tags: ["instructions", "how-to"],
        size: { width: 800, height: 1200, unit: "px" },
        layers: [
            { id: "bg", type: "shape", shapeType: "rect", x: 0, y: 0, width: 800, height: 1200, fill: "#faf5ff", stroke: "#7c3aed", strokeWidth: 3, cornerRadius: 16 },
            { id: "header-bg", type: "shape", shapeType: "rect", x: 20, y: 20, width: 760, height: 120, fill: "#7c3aed", stroke: "transparent", strokeWidth: 0, cornerRadius: 12 },
            { id: "header", type: "text", x: 40, y: 40, width: 720, height: 80, text: "HOW TO USE", fontSize: 44, fontFamily: "Arial", fontWeight: 800, fill: "#ffffff", align: "center" },
            { id: "step1", type: "text", x: 50, y: 180, width: 700, height: 80, text: "1. First step goes here", fontSize: 28, fontFamily: "Arial", fontWeight: 500, fill: "#1a1a2e" },
            { id: "step2", type: "text", x: 50, y: 280, width: 700, height: 80, text: "2. Second step goes here", fontSize: 28, fontFamily: "Arial", fontWeight: 500, fill: "#1a1a2e" },
            { id: "step3", type: "text", x: 50, y: 380, width: 700, height: 80, text: "3. Third step goes here", fontSize: 28, fontFamily: "Arial", fontWeight: 500, fill: "#1a1a2e" },
            { id: "step4", type: "text", x: 50, y: 480, width: 700, height: 80, text: "4. Fourth step goes here", fontSize: 28, fontFamily: "Arial", fontWeight: 500, fill: "#1a1a2e" },
            { id: "warning", type: "shape", shapeType: "rect", x: 40, y: 900, width: 720, height: 120, fill: "#fef3c7", stroke: "#f59e0b", strokeWidth: 2, cornerRadius: 12 },
            { id: "warning-text", type: "text", x: 60, y: 920, width: 680, height: 80, text: "⚠️ Important: Read all steps before starting", fontSize: 22, fontFamily: "Arial", fontWeight: 600, fill: "#92400e", align: "center", verticalAlign: "middle" },
        ],
    },
];
export const TemplateBrowser = ({ onSelect, onClose }) => {
    const [filter, setFilter] = useState("all");
    const [apiTemplates, setApiTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        fetchTemplates(filter)
            .then(setApiTemplates)
            .catch(() => setApiTemplates([]))
            .finally(() => setLoading(false));
    }, [filter]);
    // Merge built-in with API templates, deduplicate by id
    const allTemplates = [
        ...STARTER_TEMPLATES,
        ...apiTemplates.filter((t) => !STARTER_TEMPLATES.some((s) => s.id === t.id)),
    ].filter((t) => {
        if (filter === "all")
            return true;
        const cat = t.category ?? (t.id.includes("sticker") ? "sticker" : "full");
        return cat === filter;
    });
    return (_jsx("div", { className: "modal-overlay", onClick: onClose, children: _jsxs("div", { className: "modal", style: { minWidth: 500, maxWidth: "90vw" }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }, children: [_jsx("h2", { style: { margin: 0 }, children: "Templates" }), _jsx("button", { className: "btn btn-sm btn-ghost", onClick: onClose, children: "\u2715" })] }), _jsx("div", { style: { display: "flex", gap: 6, marginBottom: 16 }, children: ["all", "full", "sticker"].map((f) => (_jsx("button", { className: `btn btn-sm ${filter === f ? "btn-active" : ""}`, onClick: () => setFilter(f), children: f === "all" ? "All" : f === "full" ? "Full 4x6" : "Sticker Sheet" }, f))) }), _jsx("div", { className: "template-grid", children: allTemplates.map((t) => (_jsxs("div", { className: "template-card", onClick: () => {
                            onSelect(t);
                            onClose();
                        }, children: [_jsx("div", { style: {
                                    width: "100%",
                                    aspectRatio: "2/3",
                                    background: "#f8f9fa",
                                    borderRadius: 6,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 32,
                                    border: "1px solid #eee",
                                    overflow: "hidden",
                                    position: "relative",
                                }, children: _jsx("svg", { viewBox: "0 0 800 1200", style: { width: "100%", height: "100%" }, children: t.layers.slice(0, 8).map((l) => (_jsx("rect", { x: l.x, y: l.y, width: l.width, height: l.height, fill: l.type === "text"
                                            ? l.fill ?? "#333"
                                            : l.type === "shape"
                                                ? l.fill ?? "#ddd"
                                                : "#eee", opacity: 0.6, rx: 4 }, l.id))) }) }), _jsx("div", { className: "template-card-name", children: t.name }), t.description && _jsx("div", { className: "template-card-desc", children: t.description }), t.tags && (_jsx("div", { style: { display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, justifyContent: "center" }, children: t.tags.slice(0, 3).map((tag) => (_jsx("span", { style: {
                                        fontSize: 10,
                                        padding: "1px 6px",
                                        background: "var(--accent-light)",
                                        color: "var(--accent)",
                                        borderRadius: 4,
                                    }, children: tag }, tag))) }))] }, t.id))) }), loading && (_jsx("div", { style: { textAlign: "center", padding: 20, color: "var(--text-muted)" }, children: "Loading templates..." }))] }) }));
};
