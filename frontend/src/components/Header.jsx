import React from "react";
import { Sun, Moon, RefreshCw, Menu, X, FlaskConical } from "lucide-react";

function ConnectionBadge({ connection, isDemo }) {
  if (isDemo) {
    return (
      <div className="status-badge demo" title="Demo mode — no real sensor data">
        <span className="status-dot" />
        DEMO MODE
      </div>
    );
  }

  const isConnected = connection === "CONNECTED";
  const isError = connection === "ERROR";

  return (
    <div
      className={`status-badge ${isConnected ? "connected" : isError ? "error" : "connecting"}`}
      title={isConnected ? "ThingSpeak data received" : "Waiting for ThingSpeak data"}
    >
      <span className={`status-dot ${isConnected ? "pulse" : ""}`} />
      {isConnected ? "THINGSPEAK LIVE" : isError ? "CONNECTION ERROR" : (connection || "CONNECTING")}
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
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <a className="header-brand" href="#" onClick={e => e.preventDefault()} aria-label="AquaSense home">
        <div className="header-logo" aria-hidden="true">💧</div>
        <span className="header-brand-name">AquaSense</span>
      </a>

      {lastUpdate && (
        <span className="text-xs text-muted" style={{ display: "none" }} id="last-update-header">
          Updated: {lastUpdate}
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
          <FlaskConical size={14} />
          {demoMode ? "Exit Demo" : "Demo"}
        </button>

        <button
          id="refresh-btn"
          className="icon-btn"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh data now"
          title="Manual refresh"
        >
          <RefreshCw size={16} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
        </button>

        <button
          id="theme-toggle-btn"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 800px) {
          #hamburger-btn { display: grid !important; }
          #last-update-header { display: block !important; }
        }
      `}</style>
    </header>
  );
}
