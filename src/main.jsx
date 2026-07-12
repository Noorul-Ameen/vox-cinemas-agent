import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Safety net: if any render error occurs, show a small message instead of a
// blank screen, so the widget never fully disappears.
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("Widget error:", err, info); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, color: "#fff", fontFamily: "system-ui", maxWidth: 480, margin: "40px auto" }}>
          <h3 style={{ color: "#B6186C" }}>Something rendered incorrectly</h3>
          <p style={{ opacity: 0.7, fontSize: 14 }}>{String(this.state.err?.message || this.state.err)}</p>
          <button onClick={() => this.setState({ err: null })}
            style={{ marginTop: 12, background: "#63418D", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
