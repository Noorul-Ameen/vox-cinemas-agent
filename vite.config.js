import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Single Vite process. No mock server or proxy is needed. The mock data lives
// inside the app (src/mockVistaData.js). To go live, set VITE_VISTA_BASE.
// Agent IDs are public client identifiers. API keys and signed tokens must never
// be added here; they belong on a server.
const PUBLIC_AGENT_ID = "agent_0001kx3xc0b4f6s8dqy9qnejm4qr";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_AGENT_ID": JSON.stringify(
        env.VITE_AGENT_ID || PUBLIC_AGENT_ID,
      ),
    },
    server: { port: 5173 },
  };
});
