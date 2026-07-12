import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single Vite process. No mock server or proxy needed — the mock data lives
// inside the app (src/mockVistaData.js). To go live, set VITE_VISTA_BASE.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
