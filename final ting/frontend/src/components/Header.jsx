import React from "react";
import { Sun, Moon, RefreshCw, Menu, X, Droplets } from "lucide-react";

function ConnectionBadge({ connection, isDemo }) {
  if (isDemo) {
    return (
      <div className="status-badge demo" title="Demo mode: simulated data only">
        <span className="status-dot" />
        Demo Mode
      </div>
    );
  }

  const isConnected = connection === "CONNECTED";
  const isError     = connection === "ERROR";

  return (
    <div
      className={`status-badge ${isConnected ? "connected" : isError ? "error" : "connecting"}`}
      title={isConnected ? "Live ThingSpeak data" : "Waiting for data"}
    >
      <span className={`status-dot ${isConnected ? "pulse" : ""}`} />
      {isConnected ? "Live" : isError ? "Error" : connection || "Connecting..."}
    </div>
  );
}

export default function Header({
  theme,
  onToggleTheme,
  onRefresh,
  refreshing,
  connection,
  lastUpdate,
  demoMode,
  onToggleDemo,
  sidebarOpen,
  onToggleSidebar,
}) {
  return (
    <header className="app-header">
      {/* Mobile hamburger */}
      <button
        className="icon-btn"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        style={{ display: "none" }}
        id="hamburger-btn"
      >
        {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
      </button>

      <a className="header-brand" href="#" onClick={e => e.preventDefault()} aria-label="AquaTrace home">
        <div className="header-logo" aria-hidden="true">
          <Droplets size={16} />
        </div>
        <div>
          <span className="header-brand-name">AquaTrace</span>
          <span className="header-brand-sub">Smart Water Quality Monitoring</span>
        </div>
      </a>

      {lastUpdate && (
        <span
          className="text-xs text-muted"
          style={{ display: "none", marginLeft: 8, fontFamily: "JetBrains Mono, monospace" }}
          id="last-update-header"
        >
          {lastUpdate}
        </span>
      )}

      <div className="header-spacer" />

      <div className="header-actions">
        <ConnectionBadge connection={connection} isDemo={demoMode} />

        <button
          id="demo-toggle-btn"
          className={`btn btn-sm ${demoMode ? "btn-danger" : "btn-secondary"}`}
          onClick={onToggleDemo}
          title={demoMode ? "Exit demo mode" : "Enable demo mode (simulated data)"}
          aria-pressed={demoMode}
        >
          {demoMode ? "Exit Demo" : "Demo"}
        </button>

        <button
          id="refresh-btn"
          className="icon-btn"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh data"
          title="Manual refresh"
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "aq-spin 0.8s linear infinite" : "none" }} />
        </button>

        <button
          id="theme-toggle-btn"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      <style>{`
        @keyframes aq-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 800px) {
          #hamburger-btn { display: grid !important; }
          #last-update-header { display: block !important; }
        }
      `}</style>
    </header>
  );
}
