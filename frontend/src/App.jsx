import React, { useState, useEffect, useCallback } from "react";
import "./styles/index.css";

import Header    from "./components/Header";
import Sidebar   from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Settings  from "./pages/Settings";
import SensorCharts  from "./components/SensorCharts";
import AlertsPanel   from "./components/AlertsPanel";
import MLInsights    from "./components/MLInsights";
import SystemHealth  from "./components/SystemHealth";
import WaterDiagnostics from "./components/WaterDiagnostics";

import { useAquaData } from "./hooks/useAquaData";

// Page title labels
const PAGE_TITLES = {
  dashboard:   "Dashboard",
  charts:      "Sensor Trends",
  diagnostics: "Remediation & Advisory",
  alerts:      "Alerts",
  readings:    "Readings Table",
  ml:          "ML Insights",
  health:      "System Health",
  settings:    "Settings",
};

export default function App() {
  // ── Theme ────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("aq-theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("aq-theme", theme);
  }, [theme]);

  // ── Demo mode ────────────────────────────────────────────────
  const [demoMode, setDemoMode] = useState(false);

  // ── Data ─────────────────────────────────────────────────────
  const { data, health, loading, error, lastRefresh, refresh } = useAquaData(demoMode);

  // ── Navigation ───────────────────────────────────────────────
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useCallback((page) => {
    setActivePage(page);
    setSidebarOpen(false);          // Close sidebar on mobile after nav
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".app-sidebar") && !e.target.closest("#hamburger-btn")) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Refreshing state for header spinner ───────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // ── Demo banner text ─────────────────────────────────────────
  const isDemoData = data?.isDemo;

  // ── Render page content ───────────────────────────────────────
  const commonProps = {
    data, health, loading, error, lastRefresh,
    onRefresh: handleRefresh,
  };

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return <Dashboard {...commonProps} />;

      case "charts":
        return (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Sensor Trends</h1>
            <SensorCharts
              history={data?.history}
              thresholds={data?.thresholds}
              loading={loading}
            />
          </div>
        );

      case "diagnostics":
        return (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
              Water Remediation & Advisory
            </h1>
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
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Alerts</h1>
            <AlertsPanel
              latest={data?.latest}
              thresholds={data?.thresholds}
              connection={data?.connection}
              error={data?.error}
              loading={loading}
            />
          </div>
        );

      case "readings":
        return (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Readings Table</h1>
            <ReadingsTable history={data?.history} loading={loading} />
          </div>
        );

      case "ml":
        return (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>ML Insights</h1>
            <MLInsights data={data} onRetrainSuccess={handleRefresh} />
          </div>
        );

      case "health":
        return (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>System Health</h1>
            <SystemHealth data={data} health={health} lastRefresh={lastRefresh} loading={loading} />
          </div>
        );

      case "settings":
        return <Settings data={data} />;

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
        {/* Demo mode banner */}
        {isDemoData && (
          <div className="demo-banner" role="status">
            🧪 <strong>DEMO MODE</strong> — All data is entirely simulated.
            No real sensor readings are shown. Click "Exit Demo" in the header to return to live data.
          </div>
        )}

        {renderPage()}

        {/* Footer */}
        <footer style={{
          marginTop: 40,
          paddingTop: 20,
          borderTop: "1px solid var(--border)",
          textAlign: "center",
          fontSize: 11,
          color: "var(--text-muted)",
          lineHeight: 2,
        }}>
          AquaSense — Smart Water Quality Monitoring System · ESP32 + ThingSpeak + Random Forest<br />
          GOOD/BAD classification reflects configured project thresholds only, not certified drinking-water safety.<br />
          ML model is trained on synthetic data. Reported accuracy is for simulated evaluation only.
        </footer>
      </main>
    </div>
  );
}
