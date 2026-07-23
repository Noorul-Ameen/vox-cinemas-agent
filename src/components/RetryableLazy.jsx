import React from "react";
import { RefreshCw } from "lucide-react";
import { C } from "../theme.js";

class LazyPanelBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Lazy panel could not load", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return this.props.fallback({ error: this.state.error });
  }
}

function isChunkLoadError(error) {
  const description = `${String(error?.name || "")}: ${String(error?.message || error || "")} ${String(error?.request || error?.url || "")}`;
  return /failed to fetch dynamically imported module|loading chunk|importing a module script failed|chunkloaderror/i.test(description);
}

const RELEASE_RECOVERY_ERROR_CODE = "VOXI_RELEASE_RECOVERY_FAILED";

export function extractChunkUrl(error) {
  const description = `${String(error?.message || error || "")} ${String(error?.request || error?.url || "")}`;
  return description.match(/https?:\/\/[^\s"'()]+?\.js(?:\?[^\s"'()]*)?/iu)?.[0] || null;
}

export function buildChunkRetryUrl(error, { attempt = 1, baseUrl } = {}) {
  const matchedUrl = extractChunkUrl(error);
  const activeBaseUrl = baseUrl || (typeof window !== "undefined" ? window.location.href : "");
  if (!matchedUrl || !activeBaseUrl) return null;
  try {
    const base = new URL(activeBaseUrl);
    const chunk = new URL(matchedUrl, base);
    if (chunk.origin !== base.origin || !chunk.pathname.endsWith(".js")) return null;
    chunk.searchParams.set("voxi_retry", String(attempt));
    return chunk.href;
  } catch {
    return null;
  }
}

export async function loadCurrentChunkFromManifest(
  manifestKey,
  {
    attempt = 1,
    baseUrl,
    failedChunkUrl = null,
    fetchImpl = typeof fetch === "function" ? fetch : null,
    importer = (url) => import(/* @vite-ignore */ url),
    onStaleVersion = null,
    reloadImpl = typeof window !== "undefined" ? () => window.location.reload() : null,
  } = {},
) {
  const activeBaseUrl = baseUrl || (typeof window !== "undefined" ? window.location.href : "");
  if (!manifestKey || !activeBaseUrl || typeof fetchImpl !== "function") {
    throw new Error("The current asset manifest is unavailable.");
  }
  const base = new URL(activeBaseUrl);
  const manifestUrl = new URL("/asset-manifest.json", base.origin);
  manifestUrl.searchParams.set("voxi_manifest", String(attempt));
  const response = await fetchImpl(manifestUrl.href, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const contentType = response.headers?.get?.("content-type") || "";
  if (!response.ok || !/^application\/json\b/i.test(contentType)) {
    throw new Error(`The current asset manifest returned HTTP ${response.status}.`);
  }
  const manifest = await response.json();
  const entry = manifest?.[manifestKey];
  const file = typeof entry?.file === "string" ? entry.file.trim() : "";
  if (!file || !file.endsWith(".js")) {
    throw new Error(`The current asset manifest does not contain ${manifestKey}.`);
  }
  const chunk = new URL(file.replace(/^\/+/, ""), `${base.origin}/`);
  if (chunk.origin !== base.origin || !chunk.pathname.endsWith(".js")) {
    throw new Error("The current asset manifest returned an unsafe chunk URL.");
  }
  if (failedChunkUrl) {
    const failed = new URL(failedChunkUrl, base);
    if (failed.origin !== base.origin) throw new Error("The failed chunk URL was not same-origin.");
    if (failed.pathname !== chunk.pathname) {
      const preserved = await onStaleVersion?.({
        manifestKey,
        failedChunkUrl: failed.href,
        currentChunkUrl: chunk.href,
      });
      if (preserved !== true) {
        const recoveryError = new Error("The active journey could not be preserved for a release update.");
        recoveryError.code = RELEASE_RECOVERY_ERROR_CODE;
        recoveryError.request = failed.href;
        throw recoveryError;
      }
      if (typeof reloadImpl !== "function") throw new Error("A newer application release requires a page reload.");
      reloadImpl();
      return new Promise(() => {});
    }
  }
  chunk.searchParams.set("voxi_retry", String(attempt));
  return importer(chunk.href);
}

export default function RetryableLazy({
  loader,
  manifestKey = null,
  componentRef = null,
  loadingFallback = null,
  errorTitle = "This section could not load.",
  retryLabel = "Try again",
  onStaleVersion = null,
  ...props
}) {
  const [attempt, setAttempt] = React.useState(0);
  const [retryUrl, setRetryUrl] = React.useState(null);
  const [useCurrentManifest, setUseCurrentManifest] = React.useState(false);
  const [failedChunkUrl, setFailedChunkUrl] = React.useState(null);
  const onStaleVersionRef = React.useRef(onStaleVersion);
  onStaleVersionRef.current = onStaleVersion;
  const LazyComponent = React.useMemo(
    () => React.lazy(
      useCurrentManifest
        ? () => loadCurrentChunkFromManifest(manifestKey, {
            attempt,
            failedChunkUrl,
            onStaleVersion: (details) => onStaleVersionRef.current?.(details),
          })
        : retryUrl
          ? () => import(/* @vite-ignore */ retryUrl)
          : loader,
    ),
    [loader, manifestKey, attempt, retryUrl, useCurrentManifest, failedChunkUrl],
  );
  const retry = (error) => {
    const nextAttempt = attempt + 1;
    const recoveryChunkUrl = error?.code === RELEASE_RECOVERY_ERROR_CODE
      ? String(error?.request || "")
      : "";
    const chunkError = isChunkLoadError(error) || Boolean(recoveryChunkUrl);
    const chunkUrl = recoveryChunkUrl || (chunkError ? extractChunkUrl(error) : null);
    const canUseManifest = chunkError && Boolean(manifestKey) && Boolean(chunkUrl);
    setUseCurrentManifest(canUseManifest);
    setFailedChunkUrl(chunkUrl);
    setRetryUrl(chunkError && !canUseManifest ? buildChunkRetryUrl(error, { attempt: nextAttempt }) : null);
    setAttempt(nextAttempt);
  };

  return (
    <LazyPanelBoundary
      key={attempt}
      fallback={({ error }) => (
        <div role="alert" style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.surface, padding: 14, color: C.text }}>
          <div dir="auto" style={{ fontSize: 12, fontWeight: 700 }}>{errorTitle}</div>
          <button type="button" onClick={() => retry(error)} style={{ display: "inline-flex", minHeight: 40, alignItems: "center", gap: 6, marginTop: 10, border: 0, borderRadius: 8, background: C.primary, padding: "8px 12px", color: C.onPrimary, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            <RefreshCw size={13} aria-hidden="true" />{retryLabel}
          </button>
        </div>
      )}
    >
      <React.Suspense fallback={loadingFallback}>
        <LazyComponent {...props} {...(componentRef ? { ref: componentRef } : {})} />
      </React.Suspense>
    </LazyPanelBoundary>
  );
}
