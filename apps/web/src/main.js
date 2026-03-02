import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { createEmptyTemplate, mmToPxAt203Dpi } from "@tls/core";
const App = () => {
    const template = createEmptyTemplate("starter-template");
    return (_jsxs("main", { style: { fontFamily: "system-ui", margin: "2rem", maxWidth: 800 }, children: [_jsx("h1", { children: "Thermal Label Studio" }), _jsx("p", { children: "Interactive editor starter is running." }), _jsxs("ul", { children: [_jsxs("li", { children: ["4x6 @ 203 DPI width: ", mmToPxAt203Dpi(101.6), " px"] }), _jsxs("li", { children: ["4x6 @ 203 DPI height: ", mmToPxAt203Dpi(152.4), " px"] }), _jsxs("li", { children: ["Active template id: ", template.id] })] })] }));
};
createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
