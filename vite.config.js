import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { SNAPSHOT_VERSION } from "./src/generated/voxSnapshotManifest.js";

// Single Vite process. No mock server or proxy is needed. The dated schedule
// is served from versioned public shards. To go live, set VITE_VISTA_BASE.
// Agent IDs are public client identifiers. API keys and signed tokens must never
// be added here; they belong on a server.
const PUBLIC_AGENT_ID = "agent_0001kx3xc0b4f6s8dqy9qnejm4qr";

function normalizeCommit(value) {
  const commit = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{7,64}$/.test(commit) ? commit : "";
}

function resolveReleaseCommit(env) {
  const cloudflareCommit = normalizeCommit(env.CF_PAGES_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA);
  if (cloudflareCommit) return cloudflareCommit;
  try {
    const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3_000,
    });
    return normalizeCommit(gitCommit) || "local";
  } catch {
    return "local";
  }
}

function releaseMarkerPlugin(commit) {
  return {
    name: "voxi-release-marker",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "release.json",
        source: `${JSON.stringify({
          commit,
          snapshotVersion: SNAPSHOT_VERSION,
        }, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const releaseCommit = resolveReleaseCommit(env);

  return {
    plugins: [react(), releaseMarkerPlugin(releaseCommit)],
    define: {
      "import.meta.env.VITE_AGENT_ID": JSON.stringify(
        env.VITE_AGENT_ID || PUBLIC_AGENT_ID,
      ),
    },
    build: {
      manifest: "asset-manifest.json",
    },
    server: { port: 5173 },
  };
});
