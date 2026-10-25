import React from "react";
import { BarChart2, Droplets, Activity, Settings, Home, AlertTriangle, Cpu, Wifi, ShieldCheck } from "lucide-react";

const items = [
  { id: "dashboard",   label: "Dashboard",              icon: Home },
  { id: "charts",      label: "Sensor Trends",          icon: BarChart2 },
  { id: "diagnostics", label: "Remediation & Advisory", icon: ShieldCheck },
  { id: "alerts",      label: "Alerts",                 icon: AlertTriangle },
  { id: "readings",    label: "Readings Table",         icon: Activity },
  { id: "ml",          label: "ML Insights",            icon: Cpu },
  { id: "health",      label: "System Health",          icon: Wifi },
  { id: "settings",    label: "Settings",               icon: Settings },
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
          <Icon size={16} />
          {label}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{ padding: "8px 12px", fontSize: "10.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
        AquaSense v1.0<br />
        ESP32 · ThingSpeak · Flask
      </div>
    </aside>
  );
}
