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
  const description = `${String(error?.name || "")}: ${String(error?.message || error || "")}`;
  return /failed to fetch dynamically imported module|loading chunk|importing a module script failed|chunkloaderror/i.test(description);
}

export default function RetryableLazy({
  loader,
  loadingFallback = null,
  errorTitle = "This section could not load.",
  retryLabel = "Try again",
  ...props
}) {
  const [attempt, setAttempt] = React.useState(0);
  const LazyComponent = React.useMemo(() => React.lazy(loader), [loader, attempt]);
  const retry = (error) => {
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    setAttempt((current) => current + 1);
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
        <LazyComponent {...props} />
      </React.Suspense>
    </LazyPanelBoundary>
  );
}
