import React, { useState, useEffect, useCallback } from "react";
import "./styles/index.css";

import Header          from "./components/Header";
import Sidebar         from "./components/Sidebar";
import Dashboard       from "./pages/Dashboard";
import SensorCharts    from "./components/SensorCharts";
import ReadingsLog     from "./components/ReadingsLog";
import AlertsPanel     from "./components/AlertsPanel";
import WaterDiagnostics from "./components/WaterDiagnostics";

import { useAquaData } from "./hooks/useAquaData";

const PAGE_TITLES = {
  dashboard:   "Live Dashboard",
  charts:      "Sensor Trends",
  diagnostics: "Remediation & Advisory",
  alerts:      "Alerts & Status",
};

export default function App() {
  // ── Theme ───────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("aq-theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("aq-theme", theme);
  }, [theme]);

  // ── Demo mode ────────────────────────────────────────────────────
  const [demoMode, setDemoMode] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────
  const { data, health, loading, error, lastRefresh, refresh } = useAquaData(demoMode);

  // ── Navigation ───────────────────────────────────────────────────
  const [activePage, setActivePage]   = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useCallback((page) => {
    setActivePage(page);
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".app-sidebar") && !e.target.closest("#hamburger-btn")) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Refresh spinner ───────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const isDemoData = data?.isDemo;

  const commonProps = { data, health, loading, error, lastRefresh, onRefresh: handleRefresh };

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return <Dashboard {...commonProps} />;

      case "charts":
        return (
          <div>
            <div className="page-heading">
              <div className="page-title">
                <span className="page-title-dot" />
                Sensor Trends
              </div>
              <div className="page-subtitle">Historical readings from the connected sensor array</div>
            </div>
            <SensorCharts
              history={data?.history}
              thresholds={data?.thresholds}
              loading={loading}
            />
            <ReadingsLog
              history={data?.history}
              loading={loading}
              onRefresh={handleRefresh}
            />
          </div>
        );

      case "diagnostics":
        return (
          <div>
            <div className="page-heading">
              <div className="page-title">
                <span className="page-title-dot" />
                Remediation & Advisory
              </div>
              <div className="page-subtitle">Action recommendations derived from current sensor readings and thresholds</div>
            </div>
            <WaterDiagnostics
              latest={data?.latest}
              thresholds={data?.thresholds}
              fullView={true}
            />
          </div>
        );

      case "alerts":
        return (
          <div>
            <div className="page-heading">
              <div className="page-title">
                <span className="page-title-dot" />
                Alerts & Status
              </div>
              <div className="page-subtitle">Threshold-based status checks for pH, Turbidity, EC, and Temperature</div>
            </div>
            <AlertsPanel
              latest={data?.latest}
              thresholds={data?.thresholds}
              connection={data?.connection}
              error={data?.error}
              loading={loading}
            />
          </div>
        );

      default:
        return <Dashboard {...commonProps} />;
    }
  }

  return (
    <div className="app-shell">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        connection={data?.connection}
        lastUpdate={data?.last_update}
        demoMode={isDemoData}
        onToggleDemo={() => setDemoMode(d => !d)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
      />

      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        isOpen={sidebarOpen}
      />

      <main className="app-main" role="main" aria-label={PAGE_TITLES[activePage]}>
        {isDemoData && (
          <div className="demo-banner" role="status">
            <strong>DEMO MODE:</strong> All data is simulated.
            No real sensor readings are shown. Click "Exit Demo" in the header to return to live data.
          </div>
        )}

        {renderPage()}

        <footer style={{
          marginTop: 48,
          paddingTop: 22,
          borderTop: "1px solid var(--border)",
          textAlign: "center",
          fontSize: 10.5,
          color: "var(--text3)",
          lineHeight: 2.2,
          fontFamily: "JetBrains Mono, monospace",
        }}>
          AquaTrace · ESP32 + ThingSpeak + Flask · Smart Water Quality Monitoring<br />
          <span style={{ opacity: 0.6 }}>
            Assessments reflect configured project thresholds only; not a certified drinking-water safety evaluation.
          </span>
        </footer>
      </main>
    </div>
  );
}
