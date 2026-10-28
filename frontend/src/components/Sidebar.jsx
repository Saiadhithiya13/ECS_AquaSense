import React from "react";
import { BarChart2, Activity, LayoutDashboard, AlertTriangle } from "lucide-react";

const items = [
  { id: "dashboard",   label: "Dashboard",            icon: LayoutDashboard },
  { id: "charts",      label: "Sensor Trends",        icon: BarChart2 },
  { id: "diagnostics", label: "Remediation",          icon: Activity },
  { id: "alerts",      label: "Alerts & Status",      icon: AlertTriangle },
];

export default function Sidebar({ activePage, onNavigate, isOpen }) {
  return (
    <aside className={`app-sidebar${isOpen ? " open" : ""}`} role="navigation" aria-label="Main navigation">
      <div className="sidebar-label">Navigation</div>

      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-item${activePage === id ? " active" : ""}`}
          onClick={() => onNavigate(id)}
          aria-current={activePage === id ? "page" : undefined}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{
        padding: "12px 12px",
        fontSize: "10px",
        color: "var(--text-muted)",
        lineHeight: 1.8,
        borderTop: "1px solid var(--border)",
        marginTop: 8,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 3, color: "var(--text-secondary)", fontSize: 11 }}>
          AquaTrace v1.0
        </div>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5 }}>
          ESP32 · ThingSpeak<br />
          Flask · Real-time Monitoring
        </div>
      </div>
    </aside>
  );
}
