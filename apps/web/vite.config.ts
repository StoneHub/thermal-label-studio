import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The Pi serves this bundle as static files. Relative asset URLs keep it
  // deployable at either the tailnet root or a fixed subpath.
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
