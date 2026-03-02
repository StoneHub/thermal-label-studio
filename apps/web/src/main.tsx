import React from "react";
import { createRoot } from "react-dom/client";
import { createEmptyTemplate, mmToPxAt203Dpi } from "@tls/core";

const App = () => {
  const template = createEmptyTemplate("starter-template");

  return (
    <main style={{ fontFamily: "system-ui", margin: "2rem", maxWidth: 800 }}>
      <h1>Thermal Label Studio</h1>
      <p>Interactive editor starter is running.</p>
      <ul>
        <li>4x6 @ 203 DPI width: {mmToPxAt203Dpi(101.6)} px</li>
        <li>4x6 @ 203 DPI height: {mmToPxAt203Dpi(152.4)} px</li>
        <li>Active template id: {template.id}</li>
      </ul>
    </main>
  );
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
